package com.foyer.tv

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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
    val muted = Color(0xffa59d91)
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
            ),
        content = content,
    )
}

@Composable
fun Modifier.preferredFocus(enabled: Boolean = true): Modifier {
    val requester = remember { FocusRequester() }
    if (enabled) {
        LaunchedEffect(Unit) {
            withFrameNanos {}
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
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier.semantics { this.selected = selected },
        enabled = enabled,
        colors =
            ButtonDefaults.colors(
                containerColor = if (selected) Palette.primary else Palette.raised,
                contentColor =
                    if (selected) Palette.primaryText
                    else if (danger) Palette.danger else Palette.text,
                focusedContainerColor = if (danger) Palette.danger else Palette.text,
                focusedContentColor = Palette.background,
            ),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 9.dp),
    ) {
        Text(label, fontSize = 13.sp)
    }
}

@Composable
fun Heading(text: String, eyebrow: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        eyebrow?.let { Text(it, color = Palette.primary, fontSize = 11.sp, letterSpacing = 1.sp) }
        Text(text, fontSize = 27.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun Note(text: String, modifier: Modifier = Modifier, error: Boolean = false) {
    Text(
        text,
        modifier = modifier,
        color = if (error) Palette.danger else Palette.muted,
        fontSize = 13.sp,
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
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(
        onDismissRequest = { if (!busy) onClose() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            Modifier.fillMaxWidth(0.86f)
                .fillMaxHeight(0.9f)
                .background(Palette.surface, RoundedCornerShape(14.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    title,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(16.dp))
                TvButton("Close", enabled = !busy, onClick = onClose)
            }
            Column(
                Modifier.weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(4.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                content = content,
            )
        }
    }
}

@Stable
class LoadState<T> {
    var value by mutableStateOf<T?>(null)
    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)
}

@Composable
fun <T> load(vararg keys: Any?, request: suspend () -> T): LoadState<T> {
    val state = remember { LoadState<T>() }
    LaunchedEffect(*keys) {
        state.loading = true
        state.error = null
        try {
            state.value = request()
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
    if (state.loading) Note("Loading…")
    state.error?.let { Note(it, error = true) }
}
