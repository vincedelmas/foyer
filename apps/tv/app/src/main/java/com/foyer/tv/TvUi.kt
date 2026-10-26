package com.foyer.tv

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.material3.*
import kotlinx.coroutines.CancellationException

object Palette {
    val background = Color(0xff12110f)
    val surface = Color(0xff1d1b18)
    val raised = Color(0xff28241f)
    val text = Color(0xfff1ece2)
    val muted = Color(0xffbeb5a7)
    val primary = Color(0xffe69a37)
    val primaryText = Color(0xff21170d)
    val border = Color(0xff3a342c)
    val danger = Color(0xffd85e54)
}

@Composable
fun FoyerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme =
            darkColorScheme(
                primary = Palette.primary,
                onPrimary = Palette.primaryText,
                background = Palette.background,
                onBackground = Palette.text,
                surface = Palette.surface,
                onSurface = Palette.text,
                surfaceVariant = Palette.raised,
                onSurfaceVariant = Palette.muted,
                error = Palette.danger,
                border = Palette.border,
                borderVariant = Palette.primary,
            ),
        content = {
            // A color scheme alone does not set Text's inherited content color.
            Surface(
                modifier = Modifier.fillMaxSize(),
                colors =
                    SurfaceDefaults.colors(
                        containerColor = Palette.background,
                        contentColor = Palette.text,
                    ),
            ) {
                content()
            }
        },
    )
}

@Composable
fun TvPanel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .border(1.dp, Palette.border, RoundedCornerShape(12.dp))
            .background(Palette.surface, RoundedCornerShape(12.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun ProgressTrack(fraction: Float, modifier: Modifier = Modifier) {
    val progress = fraction.coerceIn(0f, 1f)
    Box(
        modifier
            .fillMaxWidth()
            .height(4.dp)
            .semantics { progressBarRangeInfo = ProgressBarRangeInfo(progress, 0f..1f) }
            .background(Palette.border, RoundedCornerShape(2.dp))
    ) {
        Box(
            Modifier.fillMaxWidth(progress)
                .fillMaxHeight()
                .background(Palette.primary, RoundedCornerShape(2.dp))
        )
    }
}

@Composable
fun Modifier.preferredFocus(enabled: Boolean = true): Modifier {
    val requester = remember { FocusRequester() }
    if (enabled) {
        LaunchedEffect(Unit) {
            requester.requestFocus()
        }
    }
    return focusRequester(requester)
}

@Composable
fun TvButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    selected: Boolean = false,
    danger: Boolean = false,
    primary: Boolean = false,
    quiet: Boolean = false,
    icon: ImageVector? = null,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier.semantics { this.selected = selected },
        enabled = enabled,
        colors =
            ButtonDefaults.colors(
                containerColor =
                    when {
                        quiet -> if (selected) Palette.raised else Color.Transparent
                        selected || primary -> Palette.primary
                        else -> Palette.raised
                    },
                contentColor =
                    if (quiet && selected) Palette.primary
                    else if (selected || primary) Palette.primaryText
                    else if (danger) Palette.danger else Palette.text,
                focusedContainerColor = if (danger) Palette.danger else Palette.text,
                focusedContentColor = Palette.background,
                disabledContainerColor = Palette.raised,
                disabledContentColor = Palette.muted,
            ),
        shape = ButtonDefaults.shape(shape = RoundedCornerShape(10.dp)),
        scale = ButtonDefaults.scale(focusedScale = 1.04f),
        border =
            ButtonDefaults.border(
                border =
                    if (quiet) Border.None
                    else
                        Border(
                            BorderStroke(1.dp, Palette.border),
                            shape = RoundedCornerShape(10.dp),
                        ),
                focusedBorder =
                    Border(BorderStroke(2.dp, Palette.primary), shape = RoundedCornerShape(10.dp)),
            ),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 11.dp),
    ) {
        icon?.let {
            Icon(it, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun TvMenuItem(
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    description: String? = null,
    selected: Boolean = false,
    enabled: Boolean = true,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    Surface(
        selected = selected,
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = SelectableSurfaceDefaults.shape(shape = RoundedCornerShape(8.dp)),
        scale = SelectableSurfaceDefaults.scale(focusedScale = 1.015f),
        colors =
            SelectableSurfaceDefaults.colors(
                containerColor = Color.Transparent,
                contentColor = if (danger) Palette.danger else Palette.text,
                focusedContainerColor = if (danger) Palette.danger else Palette.text,
                focusedContentColor = Palette.background,
                selectedContainerColor = Palette.raised,
                selectedContentColor = Palette.primary,
                focusedSelectedContainerColor = Palette.text,
                focusedSelectedContentColor = Palette.background,
                disabledContentColor = Palette.muted,
            ),
    ) {
        // Size the content row, so extra height is distributed around its contents.
        Row(
            Modifier.fillMaxWidth()
                .heightIn(min = 48.dp)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            icon?.let { Icon(it, contentDescription = null, modifier = Modifier.size(22.dp)) }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    label,
                    fontSize = 16.sp,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                description?.let {
                    Text(
                        it,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (selected)
                Icon(
                    Icons.Outlined.Check,
                    contentDescription = "Selected",
                    modifier = Modifier.size(20.dp),
                )
        }
    }
}

// Keep the whole Select gesture on the card. Opening a new focus window while
// Select is held sends its remaining repeats/release to the first menu button.
@Composable
fun TvCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLongClick: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    var heldKey by remember { mutableStateOf<Int?>(null) }
    var longPress by remember { mutableStateOf(false) }
    Card(
        onClick = onClick,
        onLongClick = onLongClick,
        modifier =
            modifier
                .onFocusChanged { if (!it.hasFocus) heldKey = null }
                .onPreviewKeyEvent { event ->
                    val key = event.nativeKeyEvent
                    if (!key.isSelect) return@onPreviewKeyEvent false
                    when (key.action) {
                        AndroidKeyEvent.ACTION_DOWN -> {
                            if (key.repeatCount == 0) {
                                heldKey = key.keyCode
                                longPress = false
                            } else if (heldKey == key.keyCode) longPress = true
                        }
                        AndroidKeyEvent.ACTION_UP -> {
                            if (heldKey == key.keyCode) {
                                heldKey = null
                                if (!key.isCanceled) {
                                    if (longPress) onLongClick() else onClick()
                                }
                            }
                        }
                    }
                    true
                },
        shape = CardDefaults.shape(shape = RoundedCornerShape(12.dp)),
        colors =
            CardDefaults.colors(
                containerColor = Color.Transparent,
                contentColor = Palette.text,
                focusedContainerColor = Color.Transparent,
                focusedContentColor = Palette.text,
            ),
        scale = CardDefaults.scale(focusedScale = if (heldKey != null) 1.015f else 1.035f),
        border =
            CardDefaults.border(
                border = Border.None,
                focusedBorder =
                    Border(BorderStroke(3.dp, Palette.primary), shape = RoundedCornerShape(12.dp)),
            ),
        content = content,
    )
}

private val AndroidKeyEvent.isSelect: Boolean
    get() =
        keyCode == AndroidKeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == AndroidKeyEvent.KEYCODE_ENTER ||
            keyCode == AndroidKeyEvent.KEYCODE_NUMPAD_ENTER

@Composable
fun Heading(text: String, eyebrow: String? = null, large: Boolean = false) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        eyebrow?.let { Text(it, color = Palette.primary, fontSize = 11.sp, letterSpacing = 1.sp) }
        Text(
            text,
            fontSize = if (large) 32.sp else 22.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = if (large) 38.sp else 28.sp,
        )
    }
}

@Composable
fun Note(text: String, modifier: Modifier = Modifier, error: Boolean = false) {
    Text(
        text,
        modifier = modifier,
        color = if (error) Palette.danger else Palette.muted,
        fontSize = 13.sp,
        lineHeight = 19.sp,
    )
}

@Composable
fun Field(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 13.sp, color = Palette.muted)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(color = Palette.text, fontSize = 15.sp),
            cursorBrush = SolidColor(Palette.primary),
            keyboardOptions =
                KeyboardOptions(keyboardType = keyboardType, autoCorrectEnabled = false),
            modifier =
                Modifier.fillMaxWidth()
                    .semantics { contentDescription = label }
                    .onFocusChanged { focused = it.isFocused }
                    .border(
                        2.dp,
                        if (focused) Palette.primary else Palette.border,
                        RoundedCornerShape(8.dp),
                    )
                    .background(Palette.background, RoundedCornerShape(8.dp))
                    .padding(12.dp),
        )
    }
}

@Composable
fun TvDialog(
    title: String,
    onClose: () -> Unit,
    busy: Boolean = false,
    sidebar: (@Composable ColumnScope.() -> Unit)? = null,
    menu: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    var heldSelect by remember { mutableStateOf<Int?>(null) }
    Dialog(
        onDismissRequest = { if (!busy) onClose() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            Modifier.widthIn(max = if (sidebar == null) 640.dp else 800.dp)
                .fillMaxWidth(0.94f)
                .heightIn(max = 460.dp)
                .onPreviewKeyEvent { event ->
                    val key = event.nativeKeyEvent
                    if (!key.isSelect) return@onPreviewKeyEvent false
                    // TV Material buttons accept orphan key-up events as clicks.
                    // Require a fresh press inside this dialog before accepting one.
                    when (key.action) {
                        AndroidKeyEvent.ACTION_DOWN -> {
                            if (key.repeatCount == 0) heldSelect = key.keyCode
                            heldSelect != key.keyCode
                        }
                        AndroidKeyEvent.ACTION_UP -> {
                            val accept = heldSelect == key.keyCode && !key.isCanceled
                            heldSelect = null
                            !accept
                        }
                        else -> false
                    }
                }
                .border(1.dp, Palette.border, RoundedCornerShape(14.dp))
                .background(Palette.surface, RoundedCornerShape(14.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    title,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(16.dp))
                TvButton(
                    "Close",
                    enabled = !busy,
                    quiet = true,
                    icon = Icons.Outlined.Close,
                    onClick = onClose,
                )
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Palette.border))
            Row(
                Modifier.weight(1f, fill = false).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                sidebar?.let {
                    Column(
                        Modifier.width(180.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        content = it,
                    )
                }
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(4.dp),
                    verticalArrangement = Arrangement.spacedBy(if (menu) 2.dp else 14.dp),
                    content = content,
                )
            }
        }
    }
}

@Stable
class LoadState<T>(initial: T? = null) {
    var value by mutableStateOf(initial)
    var loading by mutableStateOf(initial == null)
    var error by mutableStateOf<String?>(null)
}

@Composable
inline fun <reified T> load(
    api: Api,
    path: String,
    query: Map<String, String> = emptyMap(),
    revision: Int = 0,
): LoadState<T> {
    val state =
        remember(api, path) {
            // The request below reports decoding errors; a bad cached response must not crash
            // composition.
            LoadState(
                api.cached(path, query)?.let {
                    runCatching { Api.json.decodeFromString<T>(it) }.getOrNull()
                }
            )
        }
    LaunchedEffect(api, path, query, revision) {
        state.loading = true
        state.error = null
        try {
            state.value = api.get<T>(path, query)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            state.error = error.message ?: "Request failed"
        } finally {
            state.loading = false
        }
    }
    return state
}

@Composable
fun LoadNotice(state: LoadState<*>) {
    if (state.loading && state.value == null) Note("Loading…")
    state.error?.let { Note(it, error = true) }
}
