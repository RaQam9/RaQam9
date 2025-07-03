// استبدل هذا السطر بالـ appId الخاص بك
package com.raqam9.app; 

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

// استيراد الإضافات التي نستخدمها
import com.getcapacitor.plugin.PushNotifications;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // هنا نقوم بتهيئة الإضافات
    // هذا يخبر الأندرويد بأن يكون مستعدًا لاستقبال أوامر الإشعارات
    registerPlugin(PushNotifications.class);
  }
}
