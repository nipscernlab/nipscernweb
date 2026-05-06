/* tslint:disable */
/* eslint-disable */

/**
 * Allocate (or grow) the shared input buffer for `n` u64 IDs and return the
 * pointer to the first element. The pointer is valid until the next call to
 * `bulk_alloc_ids`. The JS side wraps it as a BigUint64Array view.
 */
export function bulk_alloc_ids(n: number): number;

/**
 * Decode the first `n` IDs in the shared input buffer. Returns the total
 * number of i32 slots written (= `n * 8`). 8 slots per ID, layout identical to
 * `decode_id_compact`.
 */
export function bulk_decode_ids(n: number): number;

/**
 * Pointer to the decoded result buffer. Valid after `bulk_decode_ids`.
 */
export function bulk_result_ptr(): number;

/**
 * Return a JSON array of example IDs for the UI.
 */
export function example_ids(): any;

/**
 * Parse an ATLAS compact 64-bit detector ID.
 * Returns a JSON string with all decoded fields, physical coordinates, and a summary.
 *
 * # Arguments
 * * `id_str` - 64-bit unsigned integer as decimal string (e.g. "4899916394579099648")
 */
export function parse_atlas_id(id_str: string): any;

/**
 * Bulk-decode ATLAS compact IDs in a single WASM call.
 *
 * `ids` — whitespace-separated decimal u64 strings.
 *
 * Returns a flat `Int32Array` with 8 i32 per input token.
 * See `decode_id_compact` for the per-record layout.
 */
export function parse_atlas_ids_bulk(ids: string): Int32Array;

/**
 * Parse a whitespace-separated decimal-ID string and write the decoded result
 * into the shared buffer; returns the number of i32 slots. Companion to
 * `bulk_result_ptr` — this path keeps the existing `&str` input API but avoids
 * the `Vec<i32>` → `Int32Array` copy on the JS side.
 */
export function parse_atlas_ids_bulk_zc(ids: string): number;

/**
 * Parse a full JiveXML event string.
 * Returns a JS object with all detector data and pre-decoded ATLAS ID packs.
 * The return value mirrors the protocol used by `parseXmlAndDecode` in the worker:
 *   { eventInfo, tileCells, larCells, hecCells, mbtsCells, fcalCells,
 *     tracks, photons, clusters, clusterCollections,
 *     tilePacked, larPacked, hecPacked }
 */
export function parse_jivexml(xml_text: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly bulk_alloc_ids: (a: number) => number;
    readonly bulk_decode_ids: (a: number) => number;
    readonly bulk_result_ptr: () => number;
    readonly example_ids: () => number;
    readonly parse_atlas_id: (a: number, b: number) => number;
    readonly parse_atlas_ids_bulk: (a: number, b: number, c: number) => void;
    readonly parse_atlas_ids_bulk_zc: (a: number, b: number) => number;
    readonly parse_jivexml: (a: number, b: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
