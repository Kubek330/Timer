package pl.cubeclock.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Codzienne przypomnienie o treningu. Nie przychodzi, jeśli tego dnia było już ułożenie.
 */
public class Reminders extends BroadcastReceiver {

    static final String CHANNEL = "reminders";
    private static final int REQ = 1;
    private static final int NOTIF_ID = 100;

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("cubeclock", Context.MODE_PRIVATE);
    }

    static String dayKey(Calendar cal) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, Reminders.class);
        return PendingIntent.getBroadcast(c, REQ, i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Ustawia (albo kasuje) najbliższe przypomnienie zgodnie z zapisanymi ustawieniami. */
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c);
        am.cancel(pi);
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("enabled", false)) return;

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, p.getInt("hour", 18));
        cal.set(Calendar.MINUTE, p.getInt("minute", 0));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1);
        // dokładność do kilku minut wystarczy, a nie wymaga dodatkowych uprawnień
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Przypomnienia o treningu",
                NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Codzienne przypomnienie, żeby ułożyć kostkę i nie przerwać serii.");
        nm.createNotificationChannel(ch);
    }

    static boolean allowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        // od razu planujemy jutrzejsze przypomnienie
        schedule(c);

        SharedPreferences p = prefs(c);
        if (!p.getBoolean("enabled", false) || !allowed(c)) return;

        Calendar today = Calendar.getInstance();
        String todayKey = dayKey(today);
        String last = p.getString("lastDay", "");
        if (todayKey.equals(last)) return; // dziś już był trening

        Calendar y = Calendar.getInstance();
        y.add(Calendar.DAY_OF_YEAR, -1);
        int streak = p.getInt("streak", 0);
        boolean streakAlive = streak > 0 && dayKey(y).equals(last);

        String title;
        String text;
        if (streakAlive) {
            title = "Nie przerwij serii! 🔥";
            text = "Masz " + streak + (streak == 1 ? " dzień" : " dni") + " z rzędu. Ułóż dziś kostkę chociaż raz.";
        } else {
            title = "Czas na kostkę 🧊";
            text = "Ułóż dziś chociaż raz i zacznij nową serię.";
        }

        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(c, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_cube)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(content)
                .setAutoCancel(true)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, n);
    }

    /** Po restarcie telefonu alarmy znikają, więc ustawiamy je ponownie. */
    public static class Boot extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent intent) {
            String a = intent.getAction();
            if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
                schedule(c);
            }
        }
    }
}
