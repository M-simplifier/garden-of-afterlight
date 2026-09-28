# Open a project and read its design

The viewer helps people understand types, data models and the placement of IO without reading implementations. IO/Pure are navigation hints derived from GHC types, not purity certificates.

The normal Explorer in VS Code and mini.files in Neovim show IO/Pure on audited source files and their ancestors without a verification command. Opening an audited source shows declarations first. Non-source files, generated outputs, dependencies, intentionally failing fixtures and explicitly unsupported components receive no decoration and no design projection.

Discover source directories from Cabal (including ordinary tests and benchmarks), with explicit include/exclude paths for unusual layouts. A project without build metadata can use ordinary Haskell files. Scope discovery must not read or parse excluded Haskell content. Limit/traversal failures must never turn an incomplete folder Pure.

One background index owns discovery, source snapshots, reusable GHC evidence and folder aggregation. Both editor integrations consume that index; file-decoration callbacks only look up results. Cache valid designs across sessions, validate source/configuration/compiler inputs before reuse, and invalidate only modules whose recorded dependencies changed. Coalesce edits, bound compiler work, and publish results only for the snapshot checked. First-time analysis is automatic and non-blocking; show pending rather than guessing Pure. Unsupported/failed analysis is the only unavailable state (—); pending uses … . Polymorphism, unresolved abstract effects and Safe Haskell policy do not create an unavailable state.

The current delivery is local: update both installed editors and exercise the actual ID prototype and the normal mini.files mapping. Use trusted-workspace execution in VS Code and configured trusted roots in Neovim; install this project's grant as part of the already authorized setup, without enabling arbitrary projects globally. Preserve source edits, Undo, explicit source mode and normal file-manager operations.

Acceptance: opening the project alone starts indexing; navigating the normal explorer finds IO from the root; no manual verify/open-design/tree command is needed. Warm reopening performs no GHC typechecking or source parsing for unchanged inputs. An unrelated file or excluded generated source causes no audit work. Relevant source/configuration changes cannot leave stale Pure. Measure cold/warm startup and incremental work, test ordinary excluded folders and real mini.files alongside both editor hosts, then review and install the exact artifact.

## IO classification

Use GHC-inferred types, expanding aliases and resolvable type families. Inspect declarations, source-module fields and typed expressions, including private/local definitions. A concrete IO type (or State# RealWorld) makes the file IO; otherwise completed analysis makes it Pure. Follow public class constraints, but do not inspect library bodies or private data representations. Bound recursive type expansion and stop once an IO occurrence is found. Abstract `f a` or `m a` has no IO evidence by itself; its IO instantiation does. Keep project language settings instead of imposing Safe Haskell or disabling GND.

Syntax offers provisional positive IO hints only; it can never establish Pure. A successful GHC result takes precedence over identifier spelling. Comments, strings and unused imports add no evidence. Direct unsafe IO use counts as IO, not a separate Unsafe status. Real type/compiler failures remain unavailable; never turn a failed analysis into Pure. The same two labels and availability states feed both editors and their folder summaries. Changing this classification invalidates old persisted designs.

Acceptance examples: `readName = getLine` → IO without a written signature; an imported `App = IO` alias → IO; a Foldable collection → Pure; a pure Trustworthy re-export → Pure; a pure public library API → Pure regardless of hidden unsafe internals. Keep executable-code restrictions for TH/ANN/plugins and cache input tracking independently of badge semantics.
