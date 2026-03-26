package com.motolinkbase

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MotoLinkAudioRouteModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var previousMode: Int = AudioManager.MODE_NORMAL
  private var previousSpeakerphone: Boolean = false
  private var previousMicMute: Boolean = false
  private var audioFocusRequest: AudioFocusRequest? = null
  private var sessionActive = false

  override fun getName(): String = "MotoLinkAudioRoute"

  private fun audioManager(): AudioManager {
    return reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  }

  private fun requestFocus(manager: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        .build()
      audioFocusRequest = request
      manager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      manager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun abandonFocus(manager: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { manager.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      manager.abandonAudioFocus(null)
    }
  }

  @ReactMethod
  fun startCommunication(useSpeaker: Boolean, promise: Promise) {
    try {
      val manager = audioManager()
      if (!sessionActive) {
        previousMode = manager.mode
        previousSpeakerphone = manager.isSpeakerphoneOn
        previousMicMute = manager.isMicrophoneMute
        sessionActive = true
      }

      requestFocus(manager)
      manager.mode = AudioManager.MODE_IN_COMMUNICATION
      manager.isBluetoothScoOn = false
      manager.stopBluetoothSco()
      manager.isMicrophoneMute = false
      manager.isSpeakerphoneOn = useSpeaker
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("AUDIO_ROUTE_START", error)
    }
  }

  @ReactMethod
  fun setSpeaker(useSpeaker: Boolean, promise: Promise) {
    try {
      val manager = audioManager()
      manager.mode = AudioManager.MODE_IN_COMMUNICATION
      manager.isBluetoothScoOn = false
      manager.stopBluetoothSco()
      manager.isSpeakerphoneOn = useSpeaker
      promise.resolve(useSpeaker)
    } catch (error: Exception) {
      promise.reject("AUDIO_ROUTE_SET", error)
    }
  }

  @ReactMethod
  fun stopCommunication(promise: Promise) {
    try {
      val manager = audioManager()
      manager.stopBluetoothSco()
      manager.isBluetoothScoOn = false
      manager.isSpeakerphoneOn = previousSpeakerphone
      manager.isMicrophoneMute = previousMicMute
      manager.mode = previousMode
      abandonFocus(manager)
      sessionActive = false
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("AUDIO_ROUTE_STOP", error)
    }
  }
}
