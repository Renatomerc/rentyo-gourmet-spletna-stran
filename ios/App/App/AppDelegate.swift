import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // 1. Nastavimo zeleno ozadje celotnemu oknu aplikacije (#066A69)
        self.window?.backgroundColor = UIColor(red: 6/255, green: 106/255, blue: 105/255, alpha: 1.0)
        
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

extension CAPBridgeViewController {
    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        
        guard let webView = self.webView else { return }
        
        // 2. IZKLJUČNO DO ZAČETKA ORODNE VRSTICE
        // Namesto contentInset, bomo spremenili fizični FRAME (okvir) spletne strani
        let safeAreaTop = view.safeAreaInsets.top
        
        if webView.frame.origin.y == 0 {
            var newFrame = view.bounds
            newFrame.origin.y = safeAreaTop // Premaknemo zacetek pod uro
            newFrame.size.height -= safeAreaTop // Skrajšamo stran za višino ure
            webView.frame = newFrame
        }
        
        // 3. ODSTRANIMO BELO BARVO
        // To prisili WebView, da postane prozoren in pokaže zeleno barvo spodaj
        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.scrollView.backgroundColor = .clear
        
        // Preprečimo sistemu, da bi sam popravljal odmike
        webView.scrollView.contentInsetAdjustmentBehavior = .never
    }
}