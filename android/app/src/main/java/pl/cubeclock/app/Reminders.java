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

    // dwa przypomnienia: o wybranej godzinie i "ostatnia szansa" wieczorem
    static final String KIND_DAILY = "daily";
    static final String KIND_LAST = "last";
    private static final int LAST_HOUR = 21;
    private static final int LAST_MINUTE = 30;

    private static PendingIntent alarmIntent(Context c, String kind) {
        Intent i = new Intent(c, Reminders.class).setAction("pl.cubeclock.app.REMIND_" + kind);
        i.putExtra("kind", kind);
        return PendingIntent.getBroadcast(c, KIND_LAST.equals(kind) ? REQ + 1 : REQ, i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void setAt(AlarmManager am, PendingIntent pi, int hour, int minute) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 1000) cal.add(Calendar.DAY_OF_YEAR, 1);
        // dokładność do kilku minut wystarczy, a nie wymaga dodatkowych uprawnień
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
    }

    /** Ustawia (albo kasuje) przypomnienia zgodnie z zapisanymi ustawieniami. */
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent daily = alarmIntent(c, KIND_DAILY);
        PendingIntent last = alarmIntent(c, KIND_LAST);
        am.cancel(daily);
        am.cancel(last);
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("enabled", false)) return;

        int h = p.getInt("hour", 18);
        int m = p.getInt("minute", 0);
        setAt(am, daily, h, m);
        // wieczorne przypomnienie ma sens tylko, gdy główne jest wcześniej
        boolean earlier = h * 60 + m < LAST_HOUR * 60 + LAST_MINUTE - 60;
        if (p.getBoolean("lastCall", true) && earlier) setAt(am, last, LAST_HOUR, LAST_MINUTE);
    }

    private static String days(int n) {
        return n == 1 ? "1 dzień" : n + " dni";
    }

    private static String pick(String[] options, int seed) {
        return options[Math.abs(seed) % options.length];
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Przypomnienia o treningu",
                NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Codzienne przypomnienie, żeby ułożyć kostkę i nie przerwać passy.");
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

        String kind = intent.getStringExtra("kind");
        boolean lastCall = KIND_LAST.equals(kind);
        // wieczorem przypominamy tylko o passie, która może przepaść
        if (lastCall && !streakAlive) return;

        int seed = today.get(Calendar.DAY_OF_YEAR);
        String title;
        String text;
        if (lastCall) {
            title = "Ostatnia szansa!";
            text = pick(new String[]{
                    "Twoja passa (" + days(streak) + ") przepadnie o północy. Ułóż kostkę teraz.",
                    "Jeszcze zdążysz! Jedno ułożenie ratuje passę " + days(streak) + ".",
                    "Płomień zaraz zgaśnie. " + days(streak) + " z rzędu czeka na dzisiejsze ułożenie.",
            }, seed);
        } else if (streakAlive) {
            String[][] opts = {
                    {"Nie przerwij passy!", "Masz " + days(streak) + " z rzędu. Jedno ułożenie wystarczy."},
                    {"Passa: " + days(streak), "Kostka czeka. Ułóż ją dziś chociaż raz."},
                    {days(streak) + " z rzędu!", "Nie pozwól, żeby płomień zgasł. Wpadnij na jedno ułożenie."},
                    {"Dzień " + (streak + 1) + " czeka", "Ułóż dziś kostkę i przedłuż passę."},
            };
            String[] o = opts[Math.abs(seed) % opts.length];
            title = o[0];
            text = o[1];
        } else {
            String[][] opts = {
                    {"Czas na kostkę", "Ułóż dziś chociaż raz i zacznij nową passę."},
                    {"Kostka się nudzi", "Jedno ułożenie dziennie robi różnicę."},
                    {"Krótki trening?", "Kilka ułożeń i masz pierwszy dzień passy."},
            };
            String[] o = opts[Math.abs(seed) % opts.length];
            title = o[0];
            text = o[1];
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
