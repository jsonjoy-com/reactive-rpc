# Local Repo in CRUD FS

Blocks are stored in CRUD FS in the following structure.

Each block consists of its own directory with the following structure:

```
/blocks/<collection-fragments>/<block-id>/
```

The following files are stored in the block directory:

- `model.crdt` - the latest server-side model in `binary` format.
- `patches.seq.cbor` - locally applied patches, which have not been confirmed by
  the server yet, in the CBOR sequence of patches in `binary` format.
- `meta.cbor` - metadata of the block in CBOR format.
- `history.seq.cbor.gz` - extra history (for time travel or peer sync purposes) of
  the block in `log` format. The history starts either at the inception of the
  block or any other point in time. The history ends with the same model as the
  `model.crdt` file. Hence, the end model is not stored in the history file.
