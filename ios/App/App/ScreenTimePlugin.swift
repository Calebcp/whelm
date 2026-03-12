import Foundation
import Capacitor
import UIKit
import FamilyControls

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
        if #available(iOS 16.0, *) {
            call.resolve([
                "supported": true
            ])
        } else {
            call.resolve([
                "supported": false,
                "reason": "Screen Time API requires iOS 16.0 or later."
            ])
        }
    }

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            let status = AuthorizationCenter.shared.authorizationStatus
            call.resolve([
                "status": mapStatus(status)
            ])
        } else {
            call.resolve([
                "status": "unsupported"
            ])
        }
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            Task {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    let status = AuthorizationCenter.shared.authorizationStatus
                    call.resolve([
                        "status": mapStatus(status)
                    ])
                } catch {
                    call.reject(
                        "Screen Time authorization failed: \(error.localizedDescription)",
                        "SCREEN_TIME_AUTH_ERROR"
                    )
                }
            }
        } else {
            call.resolve([
                "status": "unsupported"
            ])
        }
    }

    @objc func openSystemSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Unable to open iOS settings.", "SETTINGS_URL_ERROR")
                return
            }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve([
                        "opened": true
                    ])
                } else {
                    call.reject("iOS settings could not be opened.", "SETTINGS_OPEN_ERROR")
                }
            }
        }
    }

    @available(iOS 16.0, *)
    private func mapStatus(_ status: AuthorizationStatus) -> String {
        switch status {
        case .notDetermined:
            return "notDetermined"
        case .denied:
            return "denied"
        case .approved:
            return "approved"
        @unknown default:
            return "unknown"
        }
    }
}
