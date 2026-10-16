package com.legendarycookie.lingopractice;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "LocalExport")
public class LocalExportPlugin extends Plugin {
    private String pendingData;

    @PluginMethod
    public void saveJson(PluginCall call) {
        String data = call.getString("data");
        String fileName = call.getString("fileName");
        if (data == null || fileName == null) {
            call.reject("The export data or file name is missing.");
            return;
        }
        if (pendingData != null) {
            call.reject("An export is already waiting for a destination.");
            return;
        }
        // Capacitor persists activity-call options twice in Android's Binder bundle.
        // Keep the archive in memory, never in that size-limited saved state.
        pendingData = data;
        call.getData().remove("data");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName.replaceAll("[^a-zA-Z0-9._-]", "_"));
        startActivityForResult(call, intent, "documentSelected");
    }

    @ActivityCallback
    private void documentSelected(PluginCall call, ActivityResult result) {
        final String data = pendingData;
        pendingData = null;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        if (data == null) {
            call.reject("Export was interrupted. Your workspace is unchanged; export again.");
            return;
        }
        execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (output == null) throw new java.io.IOException("The selected file could not be opened.");
                output.write(data.getBytes(StandardCharsets.UTF_8));
                output.flush();
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception error) {
                call.reject("The export file could not be written.", error);
            }
        });
    }
}
