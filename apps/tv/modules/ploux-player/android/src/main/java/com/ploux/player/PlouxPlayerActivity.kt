package com.ploux.player

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.SeekBar
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.session.MediaSession
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import io.github.peerless2012.ass.media.AssHandler
import io.github.peerless2012.ass.media.AssHandlerConfig
import io.github.peerless2012.ass.media.factory.AssRenderersFactory
import io.github.peerless2012.ass.media.kt.withAssMkvSupport
import io.github.peerless2012.ass.media.parser.AssSubtitleParserFactory
import io.github.peerless2012.ass.media.type.AssRenderType
import io.github.peerless2012.ass.media.widget.AssSubtitleView
import java.util.Locale

@OptIn(UnstableApi::class)
class PlouxPlayerActivity : Activity(), Player.Listener {
  private lateinit var options: PlaybackOptions
  private lateinit var player: ExoPlayer
  private lateinit var mediaSession: MediaSession
  private var assHandler: AssHandler? = null
  private lateinit var progressReporter: PlaybackProgressReporter
  private lateinit var playerView: PlayerView
  private lateinit var loadingView: ProgressBar
  private lateinit var controlsView: LinearLayout
  private lateinit var errorView: LinearLayout
  private lateinit var mediaTitleView: TextView
  private lateinit var partTitleView: TextView
  private lateinit var positionView: TextView
  private lateinit var durationView: TextView
  private lateinit var timelineView: SeekBar
  private lateinit var playButton: Button
  private lateinit var previousButton: Button
  private lateinit var nextButton: Button
  private lateinit var audioButton: Button
  private lateinit var subtitleButton: Button

  private val handler = Handler(Looper.getMainLooper())
  private val resumedParts = mutableSetOf<String>()
  private var currentPart: PlaybackPart? = null
  private var controlsVisible = true
  private var lastPositionMs = 0L
  private var lastDurationMs = 0L
  private var lastSavedAt = 0L
  private var playbackError: String? = null
  private var finishedWithResult = false

  private val hideControlsRunnable = Runnable { hideControls() }
  private val progressRunnable = object : Runnable {
    override fun run() {
      if (::player.isInitialized) {
        val duration = player.duration.takeUnless { it == C.TIME_UNSET } ?: lastDurationMs
        val position = player.currentPosition.coerceAtLeast(0)
        if (duration > 0) lastDurationMs = duration
        lastPositionMs = position
        updateTimeline(position, lastDurationMs)

        val now = System.currentTimeMillis()
        if (now - lastSavedAt >= PROGRESS_SAVE_INTERVAL_MS) {
          saveProgress()
          lastSavedAt = now
        }
      }
      handler.postDelayed(this, TIMELINE_UPDATE_INTERVAL_MS)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    try {
      options = PlaybackOptions.parse(
        requireNotNull(intent.getStringExtra(EXTRA_OPTIONS)) { "Missing playback options." }
      )
    } catch (error: Throwable) {
      finishWithResult("error", error.message ?: "Invalid playback options.")
      return
    }

    progressReporter = PlaybackProgressReporter(options.serverUrl)
    createInterface()
    hideSystemUi()
    try {
      createPlayer()
      startPlayback()
      handler.post(progressRunnable)
    } catch (error: Throwable) {
      playbackError = "The native player could not be initialized: ${error.message ?: error.javaClass.simpleName}"
      showError(playbackError.orEmpty(), error.javaClass.simpleName)
    }
  }

  private fun createPlayer() {
    val httpFactory = DefaultHttpDataSource.Factory()
      .setAllowCrossProtocolRedirects(true)
      .setConnectTimeoutMs(10_000)
      .setReadTimeoutMs(20_000)
      .setUserAgent("Ploux-TV/Media3")
    val dataSourceFactory = DefaultDataSource.Factory(this, httpFactory)
    val extractorsFactory = DefaultExtractorsFactory()
      .setConstantBitrateSeekingEnabled(true)
      .setConstantBitrateSeekingAlwaysEnabled(true)

    val platformRenderers = DefaultRenderersFactory(this)
      .setEnableDecoderFallback(true)
      .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)

    val libassHandler = AssHandler(
      AssRenderType.OVERLAY_OPEN_GL,
      AssHandlerConfig(
        glyphSize = 5_000,
        cacheSize = 32,
        maxRenderPixels = 1_280 * 720,
      ),
    )
    assHandler = libassHandler

    val assSubtitleParserFactory = AssSubtitleParserFactory(libassHandler)
    val assExtractorsFactory = extractorsFactory.withAssMkvSupport(
      assSubtitleParserFactory,
      libassHandler,
    )
    val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory, assExtractorsFactory)
      .setSubtitleParserFactory(assSubtitleParserFactory)
    val renderersFactory = AssRenderersFactory(libassHandler, platformRenderers)

    val loadControl = DefaultLoadControl.Builder()
      .setBufferDurationsMs(
        12_000,
        50_000,
        750,
        1_500,
      )
      .build()

    val trackSelector = DefaultTrackSelector(this).apply {
      parameters = buildUponParameters()
        .setAllowInvalidateSelectionsOnRendererCapabilitiesChange(true)
        .build()
    }

    player = ExoPlayer.Builder(this)
      .setRenderersFactory(renderersFactory)
      .setMediaSourceFactory(mediaSourceFactory)
      .setLoadControl(loadControl)
      .setTrackSelector(trackSelector)
      .build()
      .also { exoPlayer ->
        exoPlayer.setAudioAttributes(
          AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
            .setUsage(C.USAGE_MEDIA)
            .build(),
          true,
        )
        exoPlayer.addListener(this)
        exoPlayer.repeatMode = Player.REPEAT_MODE_OFF
        libassHandler.init(exoPlayer)
      }

    playerView.player = player
    playerView.subtitleView?.addView(AssSubtitleView(this, libassHandler))
    mediaSession = MediaSession.Builder(this, player).build()
  }

  private fun startPlayback() {
    val mediaItems = options.parts.map(::asMediaItem)
    currentPart = options.parts[options.startIndex]
    player.setMediaItems(
      mediaItems,
      options.startIndex,
      currentPart?.resumePositionMs ?: 0L,
    )
    currentPart?.let { resumedParts.add(it.id) }
    updatePartInterface()
    player.prepare()
    player.playWhenReady = true
    showControls(requestPlayFocus = true)
  }

  private fun asMediaItem(part: PlaybackPart): MediaItem {
    val subtitleConfigurations = part.subtitles.map { subtitle ->
      MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitle.url))
        .setId(subtitle.id)
        .setLabel(subtitle.label)
        .setLanguage(subtitle.language)
        .setMimeType(
          if (subtitle.format == "ass" || subtitle.format == "ssa") {
            MimeTypes.TEXT_SSA
          } else {
            MimeTypes.TEXT_VTT
          }
        )
        .setSelectionFlags(if (subtitle.isDefault) C.SELECTION_FLAG_DEFAULT else 0)
        .build()
    }
    val displayTitle = part.title.ifBlank { part.fileName }

    return MediaItem.Builder()
      .setMediaId(part.id)
      .setUri(part.streamUrl)
      .setSubtitleConfigurations(subtitleConfigurations)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(displayTitle)
          .setDisplayTitle(displayTitle)
          .setAlbumTitle(options.mediaTitle)
          .build()
      )
      .build()
  }

  override fun onPlaybackStateChanged(playbackState: Int) {
    loadingView.visibility = if (
      playbackState == Player.STATE_BUFFERING || playbackState == Player.STATE_IDLE
    ) View.VISIBLE else View.GONE

    if (playbackState == Player.STATE_ENDED) {
      lastPositionMs = lastDurationMs
      saveProgress()
      showControls(requestPlayFocus = true)
      playButton.text = "Replay"
    }
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    playButton.text = if (isPlaying) "Pause" else if (player.playbackState == Player.STATE_ENDED) "Replay" else "Play"
    if (isPlaying) scheduleControlsHide() else cancelControlsHide()
  }

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
    val previousPart = currentPart
    if (previousPart != null && previousPart.id != mediaItem?.mediaId) {
      progressReporter.save(previousPart.id, lastPositionMs, lastDurationMs)
    }

    currentPart = options.parts.firstOrNull { it.id == mediaItem?.mediaId }
    lastPositionMs = 0L
    lastDurationMs = 0L
    updatePartInterface()

    val nextPart = currentPart
    if (nextPart != null && resumedParts.add(nextPart.id) && nextPart.resumePositionMs > 0) {
      handler.post { player.seekTo(nextPart.resumePositionMs) }
    }
  }

  override fun onTracksChanged(tracks: Tracks) {
    audioButton.isEnabled = audioTracks().isNotEmpty()
    subtitleButton.isEnabled = subtitleTracks().isNotEmpty()
  }

  override fun onPlayerError(error: PlaybackException) {
    loadingView.visibility = View.GONE
    playbackError = friendlyPlaybackError(error)
    showError(playbackError.orEmpty(), error.errorCodeName)
  }

  private fun togglePlayback() {
    when {
      player.playbackState == Player.STATE_ENDED -> {
        player.seekTo(0)
        player.play()
      }
      player.isPlaying -> player.pause()
      else -> player.play()
    }
    showControls()
  }

  private fun seekBy(offsetMs: Long) {
    val duration = player.duration.takeUnless { it == C.TIME_UNSET } ?: Long.MAX_VALUE
    player.seekTo((player.currentPosition + offsetMs).coerceIn(0, duration.coerceAtLeast(0)))
    updateTimeline(player.currentPosition, lastDurationMs)
    showControls()
  }

  private fun moveToPrevious() {
    saveProgress()
    if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem() else player.seekTo(0)
    player.play()
    showControls()
  }

  private fun moveToNext() {
    if (!player.hasNextMediaItem()) return
    saveProgress()
    player.seekToNextMediaItem()
    player.play()
    showControls()
  }

  private data class SelectableTrack(
    val group: Tracks.Group,
    val trackIndex: Int,
    val label: String,
    val selected: Boolean,
  )

  private fun audioTracks(): List<SelectableTrack> = tracksOfType(C.TRACK_TYPE_AUDIO)

  private fun subtitleTracks(): List<SelectableTrack> = tracksOfType(C.TRACK_TYPE_TEXT)

  private fun tracksOfType(trackType: Int): List<SelectableTrack> = buildList {
    for (group in player.currentTracks.groups) {
      if (group.type != trackType) continue
      for (index in 0 until group.length) {
        if (!group.isTrackSupported(index)) continue
        val format = group.getTrackFormat(index)
        val fallback = if (trackType == C.TRACK_TYPE_AUDIO) "Audio" else "Subtitles"
        val details = listOfNotNull(
          format.label?.takeIf { it.isNotBlank() },
          format.language?.takeIf { it.isNotBlank() && it != "und" }?.uppercase(Locale.getDefault()),
          format.codecs?.takeIf { it.isNotBlank() },
        ).distinct()
        add(
          SelectableTrack(
            group = group,
            trackIndex = index,
            label = details.joinToString(" · ").ifBlank { "$fallback ${size + 1}" },
            selected = group.isTrackSelected(index),
          )
        )
      }
    }
  }

  private fun showAudioPicker() {
    val tracks = audioTracks()
    if (tracks.isEmpty()) return
    val labels = listOf("Automatic") + tracks.map { it.label }
    val current = tracks.indexOfFirst { it.selected }.let { if (it < 0) 0 else it + 1 }

    AlertDialog.Builder(this)
      .setTitle("Audio track")
      .setSingleChoiceItems(labels.toTypedArray(), current) { dialog, choice ->
        val builder = player.trackSelectionParameters.buildUpon()
          .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
        if (choice > 0) {
          val track = tracks[choice - 1]
          builder.setOverrideForType(TrackSelectionOverride(track.group.mediaTrackGroup, track.trackIndex))
        }
        player.trackSelectionParameters = builder.build()
        dialog.dismiss()
        showControls()
      }
      .setNegativeButton("Cancel", null)
      .show()
  }

  private fun showSubtitlePicker() {
    val tracks = subtitleTracks()
    if (tracks.isEmpty()) return
    val disabled = player.trackSelectionParameters.disabledTrackTypes.contains(C.TRACK_TYPE_TEXT)
    val labels = listOf("Off") + tracks.map { it.label }
    val current = if (disabled) 0 else tracks.indexOfFirst { it.selected }.let { if (it < 0) 0 else it + 1 }

    AlertDialog.Builder(this)
      .setTitle("Subtitles")
      .setSingleChoiceItems(labels.toTypedArray(), current) { dialog, choice ->
        val builder = player.trackSelectionParameters.buildUpon()
          .clearOverridesOfType(C.TRACK_TYPE_TEXT)
          .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, choice == 0)
        if (choice > 0) {
          val track = tracks[choice - 1]
          builder.setOverrideForType(TrackSelectionOverride(track.group.mediaTrackGroup, track.trackIndex))
        }
        player.trackSelectionParameters = builder.build()
        dialog.dismiss()
        showControls()
      }
      .setNegativeButton("Cancel", null)
      .show()
  }

  private fun saveProgress() {
    val part = currentPart ?: return
    val duration = player.duration.takeUnless { it == C.TIME_UNSET } ?: lastDurationMs
    val position = if (player.playbackState == Player.STATE_ENDED) duration else player.currentPosition
    if (duration > 0) progressReporter.save(part.id, position, duration)
  }

  private fun updatePartInterface() {
    val part = currentPart ?: return
    mediaTitleView.text = options.mediaTitle
    partTitleView.text = part.title.ifBlank { part.fileName }
    previousButton.isEnabled = player.hasPreviousMediaItem()
    nextButton.isEnabled = player.hasNextMediaItem()
  }

  private fun updateTimeline(positionMs: Long, durationMs: Long) {
    positionView.text = formatTime(positionMs)
    durationView.text = formatTime(durationMs)
    timelineView.progress = if (durationMs > 0) {
      ((positionMs.coerceIn(0, durationMs) * TIMELINE_MAX) / durationMs).toInt()
    } else 0
  }

  private fun showControls(requestPlayFocus: Boolean = false) {
    if (errorView.visibility == View.VISIBLE) return
    controlsVisible = true
    controlsView.visibility = View.VISIBLE
    if (requestPlayFocus) playButton.post { playButton.requestFocus() }
    scheduleControlsHide()
  }

  private fun hideControls(force: Boolean = false) {
    if ((!player.isPlaying && !force) || errorView.visibility == View.VISIBLE) return
    controlsVisible = false
    controlsView.visibility = View.GONE
    playerView.requestFocus()
  }

  private fun scheduleControlsHide() {
    cancelControlsHide()
    if (player.isPlaying && controlsVisible) {
      handler.postDelayed(hideControlsRunnable, CONTROLS_TIMEOUT_MS)
    }
  }

  private fun cancelControlsHide() {
    handler.removeCallbacks(hideControlsRunnable)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (!::player.isInitialized) return super.dispatchKeyEvent(event)

    if (event.keyCode == KeyEvent.KEYCODE_BACK) {
      if (event.action == KeyEvent.ACTION_DOWN) {
        if (controlsVisible && errorView.visibility != View.VISIBLE) hideControls(force = true)
        else finishWithResult(if (playbackError == null) "back" else "error", playbackError)
      }
      return true
    }

    if (event.action != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event)
    if (event.repeatCount == 0) scheduleControlsHide()

    return when (event.keyCode) {
      KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
        togglePlayback()
        true
      }
      KeyEvent.KEYCODE_MEDIA_PLAY -> {
        player.play()
        showControls()
        true
      }
      KeyEvent.KEYCODE_MEDIA_PAUSE -> {
        player.pause()
        showControls()
        true
      }
      KeyEvent.KEYCODE_MEDIA_REWIND -> {
        seekBy(-SEEK_INTERVAL_MS)
        true
      }
      KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
        seekBy(SEEK_INTERVAL_MS)
        true
      }
      KeyEvent.KEYCODE_DPAD_CENTER,
      KeyEvent.KEYCODE_ENTER,
      KeyEvent.KEYCODE_NUMPAD_ENTER -> {
        if (!controlsVisible) {
          showControls(requestPlayFocus = true)
          true
        } else super.dispatchKeyEvent(event)
      }
      KeyEvent.KEYCODE_DPAD_LEFT -> {
        if (!controlsVisible) {
          seekBy(-SEEK_INTERVAL_MS)
          true
        } else super.dispatchKeyEvent(event)
      }
      KeyEvent.KEYCODE_DPAD_RIGHT -> {
        if (!controlsVisible) {
          seekBy(SEEK_INTERVAL_MS)
          true
        } else super.dispatchKeyEvent(event)
      }
      KeyEvent.KEYCODE_DPAD_UP,
      KeyEvent.KEYCODE_DPAD_DOWN -> {
        if (!controlsVisible) {
          showControls(requestPlayFocus = true)
          true
        } else super.dispatchKeyEvent(event)
      }
      else -> super.dispatchKeyEvent(event)
    }
  }

  override fun onResume() {
    super.onResume()
    hideSystemUi()
  }

  override fun onStop() {
    if (::player.isInitialized) {
      saveProgress()
      player.pause()
    }
    super.onStop()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (::player.isInitialized) {
      saveProgress()
      playerView.player = null
      if (::mediaSession.isInitialized) mediaSession.release()
      player.release()
    }
    assHandler?.release()
    assHandler = null
    if (::progressReporter.isInitialized) progressReporter.close()
    super.onDestroy()
  }

  override fun finish() {
    if (!finishedWithResult) {
      val reason = when {
        playbackError != null -> "error"
        ::player.isInitialized && player.playbackState == Player.STATE_ENDED -> "ended"
        else -> "back"
      }
      finishWithResult(reason, playbackError)
    }
    else super.finish()
  }

  private fun finishWithResult(reason: String, error: String? = null) {
    if (finishedWithResult) return
    finishedWithResult = true
    if (::player.isInitialized) saveProgress()
    val result = Intent().apply {
      putExtra(RESULT_REASON, reason)
      putExtra(RESULT_PART_ID, currentPart?.id)
      putExtra(RESULT_POSITION, lastPositionMs / 1_000.0)
      putExtra(RESULT_DURATION, lastDurationMs / 1_000.0)
      if (error != null) putExtra(RESULT_ERROR, error)
    }
    setResult(RESULT_OK, result)
    super.finish()
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
  }

  private fun friendlyPlaybackError(error: PlaybackException): String {
    var cause: Throwable? = error
    while (cause != null) {
      if (cause is HttpDataSource.InvalidResponseCodeException && cause.responseCode == 404) {
        return "This media file is no longer available. Rescan its collection in Ploux."
      }
      cause = cause.cause
    }

    return when (error.errorCode) {
      PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES ->
        "The Shield could not decode this video stream. Ploux tried hardware video decoding with decoder fallback and FFmpeg audio decoding."
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
        "The connection to the Ploux server was interrupted."
      else -> "Media3 could not play this file without video transcoding."
    }
  }

  private fun showError(message: String, technical: String) {
    controlsView.visibility = View.GONE
    controlsVisible = false
    errorView.removeAllViews()
    errorView.visibility = View.VISIBLE
    errorView.addView(textView("Playback failed", 26f, Color.WHITE, Typeface.BOLD))
    errorView.addView(textView(message, 17f, MUTED_TEXT, Typeface.NORMAL).apply {
      gravity = Gravity.CENTER
    })
    errorView.addView(textView("${currentPart?.fileName.orEmpty()} · $technical", 13f, DIM_TEXT, Typeface.NORMAL).apply {
      gravity = Gravity.CENTER
    })
    errorView.addView(horizontalRow(Gravity.CENTER).apply {
      if (::player.isInitialized) {
        addView(actionButton("Try again") {
          playbackError = null
          errorView.visibility = View.GONE
          loadingView.visibility = View.VISIBLE
          player.prepare()
          player.play()
          showControls(requestPlayFocus = true)
        })
      }
      addView(actionButton("Back") { finishWithResult("error", message) })
    })
    errorView.post { (errorView.getChildAt(3) as? ViewGroup)?.getChildAt(0)?.requestFocus() }
  }

  private fun createInterface() {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
      isFocusable = true
    }

    playerView = PlayerView(this).apply {
      useController = false
      resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
      setBackgroundColor(Color.BLACK)
      setShutterBackgroundColor(Color.BLACK)
      isFocusable = true
      isFocusableInTouchMode = true
      keepScreenOn = true
    }
    root.addView(playerView, matchParent())

    loadingView = ProgressBar(this).apply {
      isIndeterminate = true
      indeterminateTintList = ColorStateList.valueOf(ACCENT)
    }
    root.addView(
      loadingView,
      FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER),
    )

    controlsView = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.BOTTOM
      setPadding(dp(42), dp(24), dp(42), dp(28))
      background = GradientDrawable(
        GradientDrawable.Orientation.BOTTOM_TOP,
        intArrayOf(Color.argb(245, 0, 0, 0), Color.argb(220, 0, 0, 0)),
      )
    }
    root.addView(
      controlsView,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM),
    )

    mediaTitleView = textView(options.mediaTitle, 22f, Color.WHITE, Typeface.BOLD)
    partTitleView = textView("", 15f, MUTED_TEXT, Typeface.NORMAL).apply {
      setPadding(0, dp(2), 0, dp(10))
    }
    controlsView.addView(mediaTitleView)
    controlsView.addView(partTitleView)

    timelineView = SeekBar(this).apply {
      max = TIMELINE_MAX
      isFocusable = false
      isClickable = false
      progressTintList = ColorStateList.valueOf(ACCENT)
      progressBackgroundTintList = ColorStateList.valueOf(Color.rgb(73, 70, 66))
      thumbTintList = ColorStateList.valueOf(ACCENT)
    }
    controlsView.addView(timelineView, linearMatchWidth(dp(28)))

    val timeRow = horizontalRow(Gravity.CENTER_VERTICAL)
    positionView = textView("0:00", 13f, MUTED_TEXT, Typeface.NORMAL)
    durationView = textView("0:00", 13f, MUTED_TEXT, Typeface.NORMAL).apply { gravity = Gravity.END }
    timeRow.addView(positionView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    timeRow.addView(durationView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    controlsView.addView(timeRow, linearMatchWidth(ViewGroup.LayoutParams.WRAP_CONTENT))

    val actions = horizontalRow(Gravity.CENTER).apply { setPadding(0, dp(8), 0, dp(7)) }
    previousButton = actionButton("Previous") { moveToPrevious() }
    val rewindButton = actionButton("−10s") { seekBy(-SEEK_INTERVAL_MS) }
    playButton = actionButton("Play") { togglePlayback() }
    val forwardButton = actionButton("+10s") { seekBy(SEEK_INTERVAL_MS) }
    nextButton = actionButton("Next") { moveToNext() }
    audioButton = actionButton("Audio") { showAudioPicker() }
    subtitleButton = actionButton("Subtitles") { showSubtitlePicker() }
    listOf(previousButton, rewindButton, playButton, forwardButton, nextButton, audioButton, subtitleButton)
      .forEach(actions::addView)
    controlsView.addView(actions, linearMatchWidth(ViewGroup.LayoutParams.WRAP_CONTENT))

    controlsView.addView(
      textView(
        "Direct play · automatic stream-copy remux when required · Media3 with FFmpeg audio",
        12f,
        DIM_TEXT,
        Typeface.NORMAL,
      ).apply { gravity = Gravity.CENTER },
      linearMatchWidth(ViewGroup.LayoutParams.WRAP_CONTENT),
    )

    errorView = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(90), dp(60), dp(90), dp(60))
      setBackgroundColor(Color.argb(245, 0, 0, 0))
      visibility = View.GONE
    }
    root.addView(errorView, matchParent())

    setContentView(root)
  }

  private fun actionButton(label: String, onClick: () -> Unit) = Button(this).apply {
    text = label
    textSize = 14f
    isAllCaps = false
    setTextColor(Color.WHITE)
    setTypeface(typeface, Typeface.BOLD)
    setPadding(dp(16), dp(7), dp(16), dp(7))
    minWidth = dp(92)
    minimumHeight = dp(42)
    background = focusBackground()
    setOnFocusChangeListener { _, _ -> scheduleControlsHide() }
    setOnClickListener { onClick() }
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(44)).apply {
      marginStart = dp(4)
      marginEnd = dp(4)
    }
  }

  private fun focusBackground() = StateListDrawable().apply {
    addState(
      intArrayOf(android.R.attr.state_focused),
      roundedBackground(ACCENT, dp(8).toFloat()),
    )
    addState(
      intArrayOf(-android.R.attr.state_enabled),
      roundedBackground(Color.rgb(40, 39, 37), dp(8).toFloat()),
    )
    addState(
      intArrayOf(),
      roundedBackground(Color.rgb(30, 29, 27), dp(8).toFloat()),
    )
  }

  private fun roundedBackground(color: Int, radius: Float) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = radius
  }

  private fun textView(value: String, size: Float, color: Int, style: Int) = TextView(this).apply {
    text = value
    textSize = size
    setTextColor(color)
    setTypeface(Typeface.create("sans", style))
  }

  private fun horizontalRow(gravityValue: Int) = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = gravityValue
  }

  private fun matchParent() = FrameLayout.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    ViewGroup.LayoutParams.MATCH_PARENT,
  )

  private fun linearMatchWidth(height: Int) = LinearLayout.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    height,
  )

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  private fun hideSystemUi() {
    // PhoneWindow does not have a DecorView until the activity content has
    // been installed. Asking Window for its insets controller earlier crashes
    // Android 11 instead of returning null, so always resolve it via DecorView.
    val decorView = window.decorView
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      decorView.windowInsetsController?.apply {
        systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
      }
    } else {
      @Suppress("DEPRECATION")
      decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    }
  }

  private fun formatTime(milliseconds: Long): String {
    if (milliseconds <= 0) return "0:00"
    val seconds = milliseconds / 1_000
    val hours = seconds / 3_600
    val minutes = (seconds % 3_600) / 60
    val rest = seconds % 60
    return if (hours > 0) {
      "%d:%02d:%02d".format(Locale.ROOT, hours, minutes, rest)
    } else {
      "%d:%02d".format(Locale.ROOT, minutes, rest)
    }
  }

  companion object {
    const val EXTRA_OPTIONS = "com.ploux.player.OPTIONS"
    const val RESULT_REASON = "com.ploux.player.RESULT_REASON"
    const val RESULT_PART_ID = "com.ploux.player.RESULT_PART_ID"
    const val RESULT_POSITION = "com.ploux.player.RESULT_POSITION"
    const val RESULT_DURATION = "com.ploux.player.RESULT_DURATION"
    const val RESULT_ERROR = "com.ploux.player.RESULT_ERROR"

    private const val SEEK_INTERVAL_MS = 10_000L
    private const val CONTROLS_TIMEOUT_MS = 6_000L
    private const val PROGRESS_SAVE_INTERVAL_MS = 10_000L
    private const val TIMELINE_UPDATE_INTERVAL_MS = 500L
    private const val TIMELINE_MAX = 1_000
    private val ACCENT = Color.rgb(232, 135, 82)
    private val MUTED_TEXT = Color.rgb(215, 211, 205)
    private val DIM_TEXT = Color.rgb(155, 151, 145)
  }
}
