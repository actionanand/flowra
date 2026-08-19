import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configPath = resolve('android/app/src/main/assets/capacitor.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const appId = config.appId;
if (typeof appId !== 'string' || !appId) throw new Error('Android appId is missing.');
const javaPath = resolve('android/app/src/main/java', ...appId.split('.'), 'MainActivity.java');
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

await mkdir(resolve(resPath, 'drawable-nodpi'), { recursive: true });
await mkdir(resolve(resPath, 'drawable'), { recursive: true });
await copyFile(
  resolve('public/flowra.png'),
  resolve(resPath, 'drawable-nodpi/flowra_splash_logo.png'),
);
await writeFile(
  resolve(resPath, 'drawable/flowra_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:gravity="center"><bitmap android:src="@drawable/flowra_splash_logo" android:gravity="center" /></item></layer-list>\n`,
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
    await writeFile(styleFile, styles, 'utf8');
  } catch {
    /* values-night may not exist in a fresh shell */
  }
}

const java = `package ${appId};

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends BridgeActivity {
  private static final String BIOMETRIC_KEY_ALIAS = "flowra_biometric_key";
  private static final String SECURITY_PREFERENCES = "flowra_security";
  private BiometricPrompt biometricPrompt;

  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getBridge().getWebView().setBackgroundColor(Color.parseColor("#FFF7FB"));
    getBridge().getWebView().addJavascriptInterface(new FlowraNativeBridge(), "FlowraNative");
    createReminderChannel();
  }
  private void createReminderChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel("flowra-cycle-reminders", "Cycle reminders", NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("Private, on-device period prediction reminders");
    channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
    getSystemService(NotificationManager.class).createNotificationChannel(channel);
  }
  public class FlowraNativeBridge {
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
console.log(
  'Applied Flowra Android biometric, privacy, notification, splash, R8, and backup patches.',
);
