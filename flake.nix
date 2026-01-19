{
  description = "Gym & Nutrition App Development Environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            # JavaScript / Runtime
            bun
            nodejs_20
            watchman

            # Mobile Development (iOS & Android)
            cocoapods
            jdk17        # React Native requires Java 17
            android-tools # adb, fastboot, etc.
          ];

          shellHook = ''
            echo "🚀 Gym App Environment Loaded"
            echo "📦 Bun: $(bun --version) | Node: $(node --version)"
            echo "☕ Java: $(java -version 2>&1 | head -n 1)"
            
            # Android SDK Setup (Assumes standard install location on macOS)
            export ANDROID_HOME=$HOME/Library/Android/sdk
            export PATH=$PATH:$ANDROID_HOME/emulator
            export PATH=$PATH:$ANDROID_HOME/platform-tools
          '';
        };
      }
    );
}
