// تأكد من أن هذا السطر يطابق الـ appId الخاص بك
package com.raqam9.app; 

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

// تم تصحيح مسار الاستيراد هنا
import com.capacitorjs.plugins.pushnotifications.PushNotifications;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // تهيئة الإضافة
    registerPlugin(PushNotifications.class);
  }
}
