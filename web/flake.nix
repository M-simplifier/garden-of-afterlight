{
  description = "The tested Afterlight browser compiler (Linux / WSL2)";
  inputs.ghc-wasm.url = "git+https://gitlab.haskell.org/ghc/ghc-wasm-meta.git?rev=60098a5076557e327b326a1a3ba3b5fb4fec1e49";
  inputs.nixpkgs.follows = "ghc-wasm/nixpkgs";

  outputs = { self, ghc-wasm, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      # The compiler's meta-flake ships an older Cabal. Keep the tested driver.
      cabal = pkgs.stdenvNoCC.mkDerivation {
        pname = "afterlight-cabal";
        version = "3.16.1.0";
        src = pkgs.fetchurl {
          url = "https://downloads.haskell.org/~cabal/cabal-install-3.16.1.0/cabal-install-3.16.1.0-x86_64-linux-alpine3_12.tar.xz";
          sha256 = "5ebe58932e7856dd08e5617414597c5d07799d72796faf24d23f2355ca37b3df";
        };
        dontUnpack = true;
        installPhase = ''
          mkdir -p $out/bin
          tar xJf $src -C $out/bin cabal
        '';
        doInstallCheck = true;
        installCheckPhase = "$out/bin/cabal --version";
      };
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          ghc-wasm.packages.${system}.all_9_14
          cabal pkgs.python3 pkgs.curl pkgs.gnutar pkgs.patch pkgs.gnumake
        ];
        shellHook = ''
          export CABAL=${cabal}/bin/cabal
        '';
      };
    };
}
