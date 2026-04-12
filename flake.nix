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
            nodejs_20
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
          '';
        };
      }
    );
}