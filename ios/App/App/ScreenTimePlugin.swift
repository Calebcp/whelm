import Foundation
import Capacitor
import UIKit

@objc(ScreenTimePlugin)
public class ScreenTimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenTimePlugin"
    public let jsName = "ScreenTime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSystemSettings", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve([
            "supported": false,
            "reason": "Screen Time is unavailable in this App Store build."
        ])
    }

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        call.resolve([
            "status": "unsupported"
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        call.resolve([
            "status": "unsupported"
        ])
    }

    @objc func openSystemSettings(_ call: CAPPluginCall) {
        call.resolve([
            "opened": false
        ])
    }
}
