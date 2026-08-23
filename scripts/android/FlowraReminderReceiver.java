package __APP_ID__;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

public class FlowraReminderReceiver extends BroadcastReceiver {
  private static final String NOTIFICATION_CHANNEL = "flowra-cycle-reminders";

  @Override public void onReceive(Context context, Intent intent) {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
          != PackageManager.PERMISSION_GRANTED
    ) return;

    NotificationManager manager =
      (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) return;
    ensureChannel(manager);

    int id = intent.getIntExtra("id", 0);
    String title = intent.getStringExtra("title");
    String body = intent.getStringExtra("body");
    if (title == null || title.isBlank()) title = "Flowra";
    if (body == null) body = "Upcoming health reminder";

    Intent openIntent = new Intent(context, MainActivity.class);
    openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent contentIntent = PendingIntent.getActivity(
      context,
      id,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(context, NOTIFICATION_CHANNEL)
      : new Notification.Builder(context);
    Notification notification = builder
      .setSmallIcon(R.drawable.ic_stat_flowra)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(contentIntent)
      .setAutoCancel(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .build();
    manager.notify(id, notification);
  }

  private static void ensureChannel(NotificationManager manager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      NOTIFICATION_CHANNEL,
      "Cycle reminders",
      NotificationManager.IMPORTANCE_DEFAULT
    );
    channel.setDescription("Private, on-device period prediction reminders");
    channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
    manager.createNotificationChannel(channel);
  }
}
