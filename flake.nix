{
  description = "SpotMe Gym App Development Environment (Pure Nix)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true; 
          };
        };
        isDarwin = pkgs.stdenv.isDarwin;

        # Configured specifically for Expo SDK 54 / React Native 0.81
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          cmdLineToolsVersion = "13.0";
          toolsVersion = "26.1.1";
          platformToolsVersion = "35.0.1";
          
          # Exact versions requested by your Gradle build
          buildToolsVersions = [ "36.0.0" "35.0.0" ]; 
          platformVersions = [ "36" ]; 
          
          # NDK is required for compiling React Native's C++ Bridge
          includeNDK = true;
          ndkVersions = [ "27.1.12297006" ];

          cmakeVersions = [ "3.22.1" ]; 
          
          includeEmulator = false; 
          includeSystemImages = false; 
        };

        androidSdk = androidComposition.androidsdk;
      in
      {
        devShells.default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            bun
            nodejs_22 # Expo SDK 58 requires Node >= 22.13
            watchman
            jdk17
            gradle
            androidSdk
          ] ++ pkgs.lib.optionals isDarwin [
            cocoapods
          ];

          shellHook = ''
            echo "🚀 SpotMe App Environment Loaded (Pure Nix)"
            echo "📦 Bun: $(bun --version) | Node: $(node --version)"
            echo "☕ Java: $(java -version 2>&1 | head -n 1)"

            # Lock Java and Android SDK paths strictly to the Nix store
            export JAVA_HOME="${pkgs.jdk17.home}"
            export ANDROID_HOME="${androidSdk}/libexec/android-sdk"
            export ANDROID_SDK_ROOT="${androidSdk}/libexec/android-sdk"
            
            # Explicitly tell React Native where the NDK is located
            export ANDROID_NDK_ROOT="${androidSdk}/libexec/android-sdk/ndk/27.1.12297006"
            
            export PATH=$PATH:$ANDROID_HOME/emulator
            export PATH=$PATH:$ANDROID_HOME/platform-tools
            export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
          '' + pkgs.lib.optionalString isDarwin ''
            # The darwin stdenv exports MACOSX_DEPLOYMENT_TARGET=14.0; it must not leak into
            # Xcode/CocoaPods builds (the iOS target comes from app.json / expo-build-properties).
            unset MACOSX_DEPLOYMENT_TARGET DEVELOPER_DIR SDKROOT

            # iOS builds use the system Xcode, not Nix. The active developer directory must be a
            # full Xcode (not the Command Line Tools). Xcode ≤ 26 ships Simulator.app; Xcode 27
            # replaced it with DeviceHub.app, which Expo CLI only supports from SDK 56.
            XCODE_DIR="$(/usr/bin/xcode-select -p 2>/dev/null)"
            if [ -d "$XCODE_DIR/Applications/DeviceHub.app" ] && [ ! -d "$XCODE_DIR/Applications/Simulator.app" ]; then
              echo "🍎 Xcode: $XCODE_DIR (Device Hub)"
              echo "   ⚠️  Expo SDK 54 can't drive Device Hub: build from Xcode, select an Xcode 26, or upgrade to SDK ≥ 56."
            elif [ -z "$XCODE_DIR" ] || [ ! -d "$XCODE_DIR/Applications/Simulator.app" ]; then
              echo ""
              echo "⚠️  iOS: active developer dir is ''${XCODE_DIR:-none} — no Simulator there."
              echo "   Fix: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
              echo "   Then open Xcode once (Settings → Components) and install an iOS Simulator runtime."
            else
              echo "🍎 Xcode: $XCODE_DIR"
            fi
          '';
        };
      }
    );
}