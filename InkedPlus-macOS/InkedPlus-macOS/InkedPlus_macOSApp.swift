//
//  InkedPlus_macOSApp.swift
//  InkedPlus-macOS
//
//  Created by Unknown on 3/10/26.
//

import SwiftUI

@main
struct InkedPlusApp: App {
    @StateObject private var store = AppStore()
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .frame(minWidth: 900, minHeight: 600)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}
