package com.foyer.player

import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PLAYER_REQUEST_CODE = 0x504C

class FoyerPlayerModule : Module() {
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("FoyerPlayer")

    AsyncFunction("play") { optionsJson: String, promise: Promise ->
      if (pendingPromise != null) {
        promise.reject("ERR_PLAYER_ACTIVE", "A Foyer player is already active.", null)
        return@AsyncFunction
      }

      try {
        val activity = appContext.throwingActivity
        val intent = Intent(activity, FoyerPlayerActivity::class.java).apply {
          putExtra(FoyerPlayerActivity.EXTRA_OPTIONS, optionsJson)
        }
        pendingPromise = promise
        activity.startActivityForResult(intent, PLAYER_REQUEST_CODE)
        @Suppress("DEPRECATION")
        activity.overridePendingTransition(0, 0)
      } catch (error: Throwable) {
        pendingPromise = null
        promise.reject(error.toCodedException())
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PLAYER_REQUEST_CODE) return@OnActivityResult

      val data = payload.data
      pendingPromise?.resolve(
        mapOf(
          "reason" to (data?.getStringExtra(FoyerPlayerActivity.RESULT_REASON) ?: "back"),
          "partId" to data?.getStringExtra(FoyerPlayerActivity.RESULT_PART_ID),
          "positionSeconds" to data?.getDoubleExtra(FoyerPlayerActivity.RESULT_POSITION, 0.0),
          "durationSeconds" to data?.getDoubleExtra(FoyerPlayerActivity.RESULT_DURATION, 0.0),
          "error" to data?.getStringExtra(FoyerPlayerActivity.RESULT_ERROR),
        )
      )
      pendingPromise = null
    }
  }
}
