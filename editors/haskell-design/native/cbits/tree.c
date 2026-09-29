#include <tree_sitter/api.h>

extern const TSLanguage *tree_sitter_haskell(void);

/* Keep TSNode's by-value C ABI out of Haskell. The caller owns the scratch
   storage; no node handles escape the lifetime of the bracketed TSTree. */
size_t hd_node_size(void) { return sizeof(TSNode); }
bool hd_set_language(TSParser *p) { return ts_parser_set_language(p, tree_sitter_haskell()); }
void hd_root(TSTree *t, TSNode *out) { *out = ts_tree_root_node(t); }
uint32_t hd_count(const TSNode *n) { return ts_node_named_child_count(*n); }
void hd_child(const TSNode *n, uint32_t i, TSNode *out) { *out = ts_node_named_child(*n, i); }
const char *hd_field(const TSNode *n, uint32_t i) { return ts_node_field_name_for_named_child(*n, i); }
const char *hd_type(const TSNode *n) { return ts_node_type(*n); }
uint32_t hd_start(const TSNode *n) { return ts_node_start_byte(*n); }
uint32_t hd_end(const TSNode *n) { return ts_node_end_byte(*n); }
uint32_t hd_line(const TSNode *n) { return ts_node_start_point(*n).row; }
uint32_t hd_end_line(const TSNode *n) { return ts_node_end_point(*n).row; }
uint32_t hd_column(const TSNode *n) { return ts_node_start_point(*n).column; }
bool hd_error(const TSNode *n) { return ts_node_has_error(*n); }
