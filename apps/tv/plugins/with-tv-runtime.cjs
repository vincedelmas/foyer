const {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
} = require("expo/config-plugins")

const TV_BACKGROUND = "#12110f"

module.exports = function withTvRuntime(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults
    )
    const mainActivity = (application.activity ?? []).find((activity) =>
      (activity["intent-filter"] ?? []).some((filter) =>
        (filter.action ?? []).some(
          (action) => action.$["android:name"] === "android.intent.action.MAIN"
        )
      )
    )

    if (!mainActivity) {
      throw new Error("Could not find the Android TV launcher activity")
    }

    // A singleTask launcher clears the native player activity when the user
    // opens Ploux again from the TV home screen. singleTop brings the existing
    // task back with the player still on top.
    mainActivity.$["android:launchMode"] = "singleTop"
    return manifestConfig
  })

  return withAndroidColors(config, (colorsConfig) => {
    colorsConfig.modResults = AndroidConfig.Colors.assignColorValue(
      colorsConfig.modResults,
      { name: "splashscreen_background", value: TV_BACKGROUND }
    )
    return colorsConfig
  })
}
