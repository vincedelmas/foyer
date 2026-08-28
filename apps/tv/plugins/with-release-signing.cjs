const { withAppBuildGradle } = require("expo/config-plugins")

const marker = "PLOUX_TV_KEYSTORE_PATH"

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("Ploux TV release signing expects a Groovy app/build.gradle")
    }

    let contents = gradleConfig.modResults.contents
    if (contents.includes(marker)) return gradleConfig

    const debugSigningConfig = "    signingConfigs {\n        debug {"
    if (!contents.includes(debugSigningConfig)) {
      throw new Error("Could not find the Android debug signing configuration")
    }

    contents = contents.replace(
      debugSigningConfig,
      `    signingConfigs {
        release {
            def releaseStorePath = System.getenv("PLOUX_TV_KEYSTORE_PATH")
            if (releaseStorePath) {
                storeFile file(releaseStorePath)
                storePassword System.getenv("PLOUX_TV_KEYSTORE_PASSWORD")
                keyAlias System.getenv("PLOUX_TV_KEY_ALIAS")
                keyPassword System.getenv("PLOUX_TV_KEY_PASSWORD")
                storeType System.getenv("PLOUX_TV_KEYSTORE_TYPE") ?: "PKCS12"
            }
        }
        debug {`
    )

    const buildTypesStart = contents.indexOf("    buildTypes {")
    const releaseStart = contents.indexOf("        release {", buildTypesStart)
    const debugReleaseSigning = "            signingConfig signingConfigs.debug"
    const signingStart = contents.indexOf(debugReleaseSigning, releaseStart)

    if (buildTypesStart < 0 || releaseStart < 0 || signingStart < 0) {
      throw new Error("Could not find the Android release build type")
    }

    contents =
      contents.slice(0, signingStart) +
      `            signingConfig System.getenv("${marker}") ? signingConfigs.release : signingConfigs.debug` +
      contents.slice(signingStart + debugReleaseSigning.length)

    gradleConfig.modResults.contents = contents
    return gradleConfig
  })
}
