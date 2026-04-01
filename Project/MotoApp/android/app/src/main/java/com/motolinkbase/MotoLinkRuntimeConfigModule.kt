package com.motolinkbase

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class MotoLinkRuntimeConfigModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MotoLinkRuntimeConfig"

  override fun getConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "isDebugBuild" to BuildConfig.DEBUG,
      "turnUrls" to BuildConfig.MOTOLINK_TURN_URLS,
      "turnUsername" to BuildConfig.MOTOLINK_TURN_USERNAME,
      "turnCredential" to BuildConfig.MOTOLINK_TURN_CREDENTIAL,
      "supportEmail" to BuildConfig.MOTOLINK_SUPPORT_EMAIL,
      "privacyPolicyUrl" to BuildConfig.MOTOLINK_PRIVACY_POLICY_URL,
    )
}
