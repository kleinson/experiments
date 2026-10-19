// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ShellCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "ShellCore", targets: ["ShellCore"])],
    targets: [
        .target(name: "ShellCore", resources: [.process("Resources")]),
        .testTarget(name: "ShellCoreTests", dependencies: ["ShellCore"])
    ]
)
