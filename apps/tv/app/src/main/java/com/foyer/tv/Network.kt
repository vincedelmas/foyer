package com.foyer.tv

import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Request
import okhttp3.Response

// Read and close the response on OkHttp's worker, cancelling the socket with its caller.
suspend fun <T> Request.fetch(read: (Response) -> T): T =
    suspendCancellableCoroutine { continuation ->
        val call = Api.http.newCall(this)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(
            object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    val value =
                        try {
                            response.use(read)
                        } catch (error: Exception) {
                            continuation.resumeWithException(error)
                            return
                        }
                    continuation.resume(value)
                }
            }
        )
    }
