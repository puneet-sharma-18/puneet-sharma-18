package com.yapper.app

import android.app.Application

class YapperApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        UploadScheduler.schedulePeriodic(this)
        // Kick an upload pass in case something is pending from a previous run.
        UploadScheduler.enqueue(this)
    }
}
