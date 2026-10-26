package com.foyer.tv

fun formatBytes(bytes: Long): String {
    var value = bytes.toDouble()
    var unit = 0
    val units = listOf("B", "KB", "MB", "GB", "TB")
    while (value >= 1024 && unit < units.lastIndex) {
        value /= 1024
        unit++
    }
    return (if (unit > 1) "%.1f" else "%.0f").format(value) + " ${units[unit]}"
}
