import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configPath = resolve('android/app/src/main/assets/capacitor.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const appId = config.appId;
if (typeof appId !== 'string' || !appId) throw new Error('Android appId is missing.');
const javaPath = resolve('android/app/src/main/java', ...appId.split('.'), 'MainActivity.java');
const exportPluginPath = resolve(
  'android/app/src/main/java',
  ...appId.split('.'),
  'FlowraExportPlugin.java',
);
const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const gradlePath = resolve('android/app/build.gradle');
const proguardPath = resolve('android/app/proguard-rules.pro');
const resPath = resolve('android/app/src/main/res');
await access(javaPath).catch(() => {
  throw new Error('Run "npm run android:add" before patching Android.');
});

let manifest = await readFile(manifestPath, 'utf8');
for (const permission of [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
]) {
  if (!manifest.includes(permission))
    manifest = manifest.replace(
      /(<manifest[^>]*>)/,
      `$1\n    <uses-permission android:name="${permission}" />`,
    );
}
manifest = manifest.replace(/<application\b[^>]*>/, (application) => {
  const attributes = [
    ['android:allowBackup', 'false'],
    ['android:fullBackupContent', '@xml/backup_rules'],
    ['android:dataExtractionRules', '@xml/data_extraction_rules'],
  ];
  return attributes.reduce(
    (value, [name, setting]) =>
      new RegExp(`${name}="[^"]*"`).test(value)
        ? value.replace(new RegExp(`${name}="[^"]*"`), `${name}="${setting}"`)
        : value.replace(/>$/, `\n        ${name}="${setting}">`),
    application,
  );
});
if (!manifest.includes('androidx.core.content.FileProvider'))
  manifest = manifest.replace(
    /<\/application>/,
    `        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/flowra_file_paths" />
        </provider>
    </application>`,
  );
await writeFile(manifestPath, manifest, 'utf8');

await mkdir(resolve(resPath, 'xml'), { recursive: true });
const domains = ['root', 'file', 'database', 'sharedpref', 'external'];
await writeFile(
  resolve(resPath, 'xml/backup_rules.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${domains.map((domain) => `  <exclude domain="${domain}" path="." />`).join('\n')}\n</full-backup-content>\n`,
);
await writeFile(
  resolve(resPath, 'xml/data_extraction_rules.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules><cloud-backup>${domains.map((domain) => `<exclude domain="${domain}" path="." />`).join('')}</cloud-backup><device-transfer>${domains.map((domain) => `<exclude domain="${domain}" path="." />`).join('')}</device-transfer></data-extraction-rules>\n`,
);
await writeFile(
  resolve(resPath, 'xml/flowra_file_paths.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="exports" path="exports/" /></paths>\n`,
);

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle
  .replace(/minifyEnabled\s+false/, 'minifyEnabled true')
  .replace(
    /getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')",
  );
if (!gradle.includes('shrinkResources true'))
  gradle = gradle.replace(
    /minifyEnabled\s+true/,
    'minifyEnabled true\n            shrinkResources true',
  );
if (!gradle.includes('androidx.biometric:biometric'))
  gradle = gradle.replace(
    /dependencies\s*\{/,
    "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'",
  );
await writeFile(gradlePath, gradle, 'utf8');
let proguard = await readFile(proguardPath, 'utf8');
if (!proguard.includes('@android.webkit.JavascriptInterface'))
  proguard +=
    '\n# Preserve the narrow native bridge exposed to the Flowra WebView.\n-keepclassmembers class * {\n    @android.webkit.JavascriptInterface <methods>;\n}\n';
if (!proguard.includes('com.google.errorprone.annotations'))
  proguard +=
    '\n# Suppress R8 warnings for compile-time annotation classes used by Tink and Guava.\n-dontwarn com.google.errorprone.annotations.**\n-dontwarn javax.annotation.**\n-dontwarn javax.annotation.concurrent.**\n';
await writeFile(proguardPath, proguard, 'utf8');

const drawableDirectories = (await readdir(resPath, { withFileTypes: true })).filter(
  (entry) => entry.isDirectory() && entry.name.startsWith('drawable'),
);
for (const directory of drawableDirectories) {
  const splashPng = resolve(resPath, directory.name, 'splash.png');
  await rm(splashPng, { force: true });
  if (directory.name !== 'drawable')
    await rm(resolve(resPath, directory.name, 'splash.xml'), { force: true });
}
await mkdir(resolve(resPath, 'drawable-nodpi'), { recursive: true });
await mkdir(resolve(resPath, 'drawable'), { recursive: true });
await copyFile(
  resolve('public/flowra.png'),
  resolve(resPath, 'drawable-nodpi/flowra_splash_logo.png'),
);
await writeFile(
  resolve(resPath, 'drawable/flowra_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:width="160dp" android:height="160dp" android:gravity="center">
        <shape android:shape="oval"><solid android:color="#FFF0F6" /></shape>
    </item>
    <item android:width="104dp" android:height="104dp" android:gravity="center">
        <bitmap android:src="@drawable/flowra_splash_logo" android:gravity="fill" />
    </item>
</layer-list>\n`,
);
await writeFile(
  resolve(resPath, 'drawable/splash.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape android:shape="rectangle"><solid android:color="#FFF7FB" /></shape></item>
    <item android:drawable="@drawable/flowra_splash_icon" android:gravity="center" />
</layer-list>\n`,
);
await writeFile(
  resolve(resPath, 'drawable/ic_stat_flowra.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M12,21c-4.4,-2.8 -7,-6.1 -7,-10a4.5,4.5 0,0 1,8 -2.8A4.5,4.5 0,0 1,21 11c0,3.9 -2.6,7.2 -9,10z"/></vector>\n`,
);

for (const styleFile of [
  resolve(resPath, 'values/styles.xml'),
  resolve(resPath, 'values-night/styles.xml'),
]) {
  try {
    let styles = await readFile(styleFile, 'utf8');
    styles = styles.replace(
      /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)[\s\S]*?(<\/style>)/,
      `$1\n        <item name="windowSplashScreenBackground">#FFF7FB</item>\n        <item name="windowSplashScreenAnimatedIcon">@drawable/flowra_splash_icon</item>\n        <item name="windowSplashScreenIconBackgroundColor">@android:color/transparent</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n    $2`,
    );
    styles = styles.replace(
      /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)(<\/style>)/,
      (_match, open, body, close) => {
        const background = '        <item name="android:background">@drawable/splash</item>';
        const patched = body.includes('android:background')
          ? body.replace(/\s*<item name="android:background">[\s\S]*?<\/item>/, `\n${background}`)
          : `${body}${background}\n`;
        return `${open}${patched}${close}`;
      },
    );
    await writeFile(styleFile, styles, 'utf8');
  } catch {
    /* values-night may not exist in a fresh shell */
  }
}

const java = `package ${appId};

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends BridgeActivity {
  private static final int CREATE_BACKUP_REQUEST = 4101;
  private static final int OPEN_BACKUP_REQUEST = 4102;
  private static final int NOTIFICATION_PERMISSION_REQUEST = 4103;
  private static final String NOTIFICATION_CHANNEL = "flowra-cycle-reminders";
  private static final String BIOMETRIC_KEY_ALIAS = "flowra_biometric_key";
  private static final String SECURITY_PREFERENCES = "flowra_security";
  private BiometricPrompt biometricPrompt;
  private byte[] pendingBackup;
  private View launchOverlay;

  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FlowraExportPlugin.class);
    super.onCreate(savedInstanceState);
    showLaunchOverlay();
    getBridge().getWebView().setBackgroundColor(Color.parseColor("#FFF7FB"));
    getBridge().getWebView().addJavascriptInterface(new FlowraNativeBridge(), "FlowraNative");
    if (hasNotificationPermission()) ensureReminderNotificationChannel();
  }
  private void ensureReminderNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(NOTIFICATION_CHANNEL, "Cycle reminders", NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("Private, on-device period prediction reminders");
    channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
    manager.createNotificationChannel(channel);
  }
  public class FlowraNativeBridge {
    @JavascriptInterface public void hideSplash() {
      runOnUiThread(() -> hideLaunchOverlay());
    }

    @JavascriptInterface public void saveBackup(String fileName, String base64Data) {
      runOnUiThread(() -> {
        try {
          pendingBackup = Base64.decode(base64Data, Base64.DEFAULT);
          Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
          intent.addCategory(Intent.CATEGORY_OPENABLE);
          intent.setType("application/octet-stream");
          intent.putExtra(Intent.EXTRA_TITLE, fileName);
          startActivityForResult(intent, CREATE_BACKUP_REQUEST);
        } catch (Exception error) {
          dispatchNativeResult("backup-saved", false, "", error.getMessage());
        }
      });
    }

    @JavascriptInterface public void openBackup() {
      runOnUiThread(() -> {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(intent, OPEN_BACKUP_REQUEST);
      });
    }

    @JavascriptInterface public void setScreenshotProtection(boolean enabled) {
      runOnUiThread(() -> { if (enabled) getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE); else getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE); });
    }

    @JavascriptInterface public boolean isBiometricAvailable() {
      return BiometricManager.from(MainActivity.this).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface public void enableBiometric(String secret) {
      runOnUiThread(() -> {
        byte[] plaintext = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
          clearBiometricState();
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.ENCRYPT_MODE, createBiometricKey());
          showBiometricPrompt("Enable biometric unlock", cipher, () -> {
            try {
              byte[] encrypted = cipher.doFinal(plaintext);
              getSharedPreferences(SECURITY_PREFERENCES, MODE_PRIVATE).edit()
                .putString("wrapped_pin", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString("wrapped_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
              java.util.Arrays.fill(plaintext, (byte) 0);
              dispatchNativeResult("biometric-enabled", true, "", "");
            } catch (Exception error) {
              java.util.Arrays.fill(plaintext, (byte) 0);
              clearBiometricState();
              dispatchNativeResult("biometric-enabled", false, "", error.getMessage());
            }
          }, "biometric-enabled");
        } catch (Exception error) {
          java.util.Arrays.fill(plaintext, (byte) 0);
          clearBiometricState();
          dispatchNativeResult("biometric-enabled", false, "", error.getMessage());
        }
      });
    }

    @JavascriptInterface public void authenticateBiometric() {
      runOnUiThread(() -> {
        try {
          String wrapped = getSharedPreferences(SECURITY_PREFERENCES, MODE_PRIVATE).getString("wrapped_pin", null);
          String iv = getSharedPreferences(SECURITY_PREFERENCES, MODE_PRIVATE).getString("wrapped_iv", null);
          if (wrapped == null || iv == null) throw new IllegalStateException("Biometric unlock is not configured on this device.");
          KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
          keyStore.load(null);
          SecretKey key = (SecretKey) keyStore.getKey(BIOMETRIC_KEY_ALIAS, null);
          if (key == null) throw new IllegalStateException("Enable biometric unlock again from Settings.");
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT)));
          showBiometricPrompt("Unlock Flowra", cipher, () -> {
            try {
              byte[] raw = cipher.doFinal(Base64.decode(wrapped, Base64.DEFAULT));
              String pin = new String(raw, java.nio.charset.StandardCharsets.UTF_8);
              java.util.Arrays.fill(raw, (byte) 0);
              dispatchNativeResult("biometric-unlock", true, pin, "");
            } catch (Exception error) {
              dispatchNativeResult("biometric-unlock", false, "", error.getMessage());
            }
          }, "biometric-unlock");
        } catch (Exception error) {
          dispatchNativeResult("biometric-unlock", false, "", "Biometric credentials changed or are unavailable. Use the app PIN, then enable biometrics again.");
        }
      });
    }

    @JavascriptInterface public void disableBiometric() { clearBiometricState(); }

    @JavascriptInterface public boolean notificationPermissionGranted() {
      return hasNotificationPermission();
    }

    @JavascriptInterface public void requestNotificationPermission() {
      runOnUiThread(() -> {
        try {
          if (hasNotificationPermission()) {
            ensureReminderNotificationChannel();
            dispatchNativeResult("notification-permission", true, "granted", "");
            return;
          }
          requestPermissions(
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            NOTIFICATION_PERMISSION_REQUEST
          );
        } catch (Exception error) {
          dispatchNativeResult(
            "notification-permission",
            false,
            "",
            error.getMessage() == null
              ? "Notification permission could not be requested."
              : error.getMessage()
          );
        }
      });
    }

    @JavascriptInterface public void ensureNotificationChannel() {
      ensureReminderNotificationChannel();
    }
  }

  private boolean hasNotificationPermission() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
      || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED;
  }

  @Override public void onRequestPermissionsResult(
    int requestCode,
    String[] permissions,
    int[] grantResults
  ) {
    if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
      boolean granted =
        grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
      if (granted) ensureReminderNotificationChannel();
      dispatchNativeResult(
        "notification-permission",
        true,
        granted ? "granted" : "denied",
        ""
      );
      return;
    }
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != CREATE_BACKUP_REQUEST && requestCode != OPEN_BACKUP_REQUEST) return;
    String action = requestCode == CREATE_BACKUP_REQUEST ? "backup-saved" : "backup-opened";
    if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
      pendingBackup = null;
      dispatchNativeResult(action, false, "", "File selection was cancelled.");
      return;
    }
    Uri uri = data.getData();
    try {
      if (requestCode == CREATE_BACKUP_REQUEST) {
        try (OutputStream output = getContentResolver().openOutputStream(uri)) {
          if (output == null) throw new IllegalStateException("The selected file could not be opened.");
          output.write(pendingBackup);
        }
        pendingBackup = null;
        dispatchNativeResult(action, true, "", "");
        return;
      }
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      try (InputStream input = getContentResolver().openInputStream(uri)) {
        if (input == null) throw new IllegalStateException("The selected file could not be opened.");
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
      }
      dispatchNativeResult(action, true, Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP), "");
    } catch (Exception error) {
      pendingBackup = null;
      dispatchNativeResult(action, false, "", error.getMessage());
    }
  }

  private void showLaunchOverlay() {
    FrameLayout overlay = new FrameLayout(this);
    overlay.setBackgroundColor(Color.parseColor("#FFF7FB"));
    overlay.setClickable(true);
    ImageView icon = new ImageView(this);
    icon.setImageResource(R.drawable.flowra_splash_logo);
    icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
    int padding = dp(25);
    icon.setPadding(padding, padding, padding, padding);
    GradientDrawable tile = new GradientDrawable();
    tile.setShape(GradientDrawable.OVAL);
    tile.setColor(Color.parseColor("#FFF0F6"));
    icon.setBackground(tile);
    icon.setElevation(dp(6));
    FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(dp(164), dp(164));
    layout.gravity = Gravity.CENTER;
    overlay.addView(icon, layout);
    addContentView(overlay, new ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    ));
    launchOverlay = overlay;
  }

  private void hideLaunchOverlay() {
    View overlay = launchOverlay;
    if (overlay == null) return;
    launchOverlay = null;
    overlay.animate().alpha(0f).setDuration(180).withEndAction(() -> {
      if (overlay.getParent() instanceof ViewGroup)
        ((ViewGroup) overlay.getParent()).removeView(overlay);
    }).start();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private SecretKey createBiometricKey() throws Exception {
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
      BIOMETRIC_KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setUserAuthenticationRequired(true)
      .setInvalidatedByBiometricEnrollment(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
    } else {
      builder.setUserAuthenticationValidityDurationSeconds(-1);
    }
    generator.init(builder.build());
    return generator.generateKey();
  }

  private void clearBiometricState() {
    try {
      getSharedPreferences(SECURITY_PREFERENCES, MODE_PRIVATE).edit().clear().apply();
      KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
      keyStore.load(null);
      if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
    } catch (Exception ignored) { }
  }

  private void showBiometricPrompt(String title, Cipher cipher, Runnable success, String action) {
    if (biometricPrompt != null) {
      dispatchNativeResult(action, false, "", "Biometric authentication is already in progress.");
      return;
    }
    try {
      Executor executor = ContextCompat.getMainExecutor(this);
      biometricPrompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
          super.onAuthenticationSucceeded(result);
          biometricPrompt = null;
          success.run();
        }
        @Override public void onAuthenticationError(int code, CharSequence message) {
          super.onAuthenticationError(code, message);
          biometricPrompt = null;
          dispatchNativeResult(action, false, "", message.toString());
        }
      });
      BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
        .setTitle(title)
        .setSubtitle("Confirm your identity on this device")
        .setNegativeButtonText("Use app PIN")
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .build();
      biometricPrompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
    } catch (RuntimeException error) {
      biometricPrompt = null;
      dispatchNativeResult(action, false, "", error.getMessage());
    }
  }

  private void dispatchNativeResult(String action, boolean success, String data, String message) {
    runOnUiThread(() -> {
      if (isFinishing() || getBridge() == null || getBridge().getWebView() == null) return;
      String script = "window.dispatchEvent(new CustomEvent('flowra-native-result',{detail:{"
        + "action:" + JSONObject.quote(action) + ","
        + "success:" + success + ","
        + "data:" + JSONObject.quote(data == null ? "" : data) + ","
        + "message:" + JSONObject.quote(message == null ? "" : message)
        + "}}));";
      getBridge().getWebView().evaluateJavascript(script, null);
    });
  }
}
`;
await mkdir(dirname(javaPath), { recursive: true });
await writeFile(javaPath, java, 'utf8');
const exportPluginTemplate = await readFile(
  resolve('scripts/android/FlowraExportPlugin.java'),
  'utf8',
);
await writeFile(exportPluginPath, exportPluginTemplate.replaceAll('__APP_ID__', appId), 'utf8');
console.log(
  'Applied Flowra Android biometric, privacy, notification, splash, export, R8, and backup patches.',
);
