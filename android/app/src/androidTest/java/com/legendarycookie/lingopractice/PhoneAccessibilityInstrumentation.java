package com.legendarycookie.lingopractice;

import android.app.Instrumentation;
import android.content.Intent;
import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.graphics.Rect;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityManager;
import org.json.JSONArray;

/** Runs only against the separate QA package, retaining the real TalkBack service. */
public final class PhoneAccessibilityInstrumentation extends Instrumentation {
    private UiAutomation automation;
    private Bundle arguments;
    private final JSONArray checks = new JSONArray();

    @Override public void onCreate(Bundle args) { super.onCreate(args); arguments = args; start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            if (!getTargetContext().getPackageName().equals("com.legendarycookie.lingopractice.qa")) throw new IllegalStateException("QA package required");
            AccessibilityManager manager = getTargetContext().getSystemService(AccessibilityManager.class);
            if (!manager.isTouchExplorationEnabled()) throw new IllegalStateException("Enable TalkBack before this check");
            automation = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
            AccessibilityServiceInfo info = automation.getServiceInfo();
            info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            automation.setServiceInfo(info);
            Intent launch = getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivitySync(launch);
            SystemClock.sleep(1500);
            boolean chinese = "zh-CN".equals(arguments.getString("language"));
            AccessibilityNodeInfo heading = find(chinese ? "用心传达原意。" : "Translate with intention.");
            if (heading == null) throw new IllegalStateException("Expected QA starting page");
            heading.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS);
            SystemClock.sleep(700);
            String before = focusedText();
            if (before.isEmpty()) throw new IllegalStateException("No accessibility focus");
            Rect bounds = new Rect(); root().getBoundsInScreen(bounds);
            shell("input touchscreen swipe " + (int)(bounds.width()*.3) + " " + bounds.height()/2 + " " + (int)(bounds.width()*.7) + " " + bounds.height()/2 + " 150");
            SystemClock.sleep(1200);
            String after = focusedText();
            boolean swipeAdvanced = !after.isEmpty() && !before.equals(after);
            result.putBoolean("swipeAdvanced", swipeAdvanced);
            if (!swipeAdvanced) {
                shell("input keycombination 57 22");
                SystemClock.sleep(1000);
                after = focusedText();
                if (after.isEmpty() || before.equals(after)) throw new IllegalStateException("TalkBack swipe and keyboard commands did not advance focus: before=" + before + "; after=" + after);
                checks.put("TalkBack Alt+Right moves accessibility focus; injected swipe remains unqualified");
            } else checks.put("Real TalkBack touch exploration moves accessibility focus");
            click(chinese ? "设置" : "Settings");
            SystemClock.sleep(700);
            String delete = chinese ? "删除本地数据" : "Delete local data";
            click(delete);
            SystemClock.sleep(1000);
            String cancel = chinese ? "保留本地数据" : "Keep local data";
            if (find(cancel) == null) throw new IllegalStateException("Missing labeled dialog cancel action");
            key(KeyEvent.KEYCODE_TAB);
            SystemClock.sleep(500);
            if (find(chinese ? "确认删除" : "Confirm deletion") == null) throw new IllegalStateException("Missing labeled confirm action");
            checks.put("TalkBack exposes named delete dialog and both actions");
            key(KeyEvent.KEYCODE_BACK);
            SystemClock.sleep(700);
            if (find(cancel) != null) throw new IllegalStateException("Back did not cancel the dialog");
            if (find(delete) == null) throw new IllegalStateException("Dialog trigger missing after cancellation");
            checks.put("Hardware Back cancels without deleting the QA workspace");
            result.putString("checks", checks.toString());
            result.putString("focusBefore", before); result.putString("focusAfter", after);
            finish(0, result);
        } catch (Throwable error) { result.putString("failure", error.toString()); result.putString("checks", checks.toString()); finish(1, result); }
    }
    private AccessibilityNodeInfo root() {
        AccessibilityNodeInfo root = null;
        for (int attempt=0; attempt<25; attempt++) {
            root=automation.getRootInActiveWindow();
            if (root!=null && "com.legendarycookie.lingopractice.qa".contentEquals(root.getPackageName())) return root;
            SystemClock.sleep(200);
        }
        throw new IllegalStateException("Only the foreground QA app may be inspected: " + (root==null ? "no active window" : root.getPackageName()));
    }
    private String label(AccessibilityNodeInfo node) {
        if (node == null) return "";
        CharSequence text = node.getText() != null ? node.getText() : node.getContentDescription();
        return text == null ? "" : text.toString().trim();
    }
    private String focusedText() { return label(root().findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY)); }
    private AccessibilityNodeInfo find(String text) { return findIn(root(), text); }
    private AccessibilityNodeInfo findIn(AccessibilityNodeInfo node, String text) {
        if (text.equals(label(node)) || (node.getContentDescription() != null && text.equals(node.getContentDescription().toString().trim()))) return node;
        for (int i = 0; i < node.getChildCount(); i++) { AccessibilityNodeInfo child = node.getChild(i); if (child != null) { AccessibilityNodeInfo found = findIn(child, text); if (found != null) return found; } }
        return null;
    }
    private String labels(AccessibilityNodeInfo node) {
        StringBuilder output = new StringBuilder();
        if (!label(node).isEmpty()) output.append("[").append(label(node)).append("]");
        for (int i=0; i<node.getChildCount() && output.length()<3000; i++) { AccessibilityNodeInfo child=node.getChild(i); if(child!=null) output.append(labels(child)); }
        return output.toString();
    }
    private void click(String text) {
        AccessibilityNodeInfo node = find(text);
        if (node == null) throw new IllegalStateException("Control missing: " + text + "; QA labels: " + labels(root()));
        node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId());
        if (!node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) throw new IllegalStateException("Control did not activate: " + text);
    }
    private void key(int code) {
        automation.injectInputEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code), true);
        automation.injectInputEvent(new KeyEvent(KeyEvent.ACTION_UP, code), true);
    }
    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor descriptor = automation.executeShellCommand(command);
             java.io.FileInputStream input = new java.io.FileInputStream(descriptor.getFileDescriptor())) {
            byte[] buffer = new byte[1024]; while (input.read(buffer) != -1) { }
        }
    }
}
