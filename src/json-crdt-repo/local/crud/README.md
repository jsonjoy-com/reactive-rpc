# Local Repo in CRUD FS

This module implements `LocalRepo` in file system backed by the CRUD FS. The 
CRUD FS can be powered by browser's File System Standard or Node's `fs` module.


## Folder layout

Each block consists of its own directory with at the following path:

```
/blocks/<collection-fragments>/<block-id>/
```

Synchronization information with remote is stored at:

```
/sync/
```

The "dirty" folder contains a set of all blocks that are marked for
synchronization. A block is marked for synchronization when the below empty
file is created:

```
/sync/dirty/<collection-fragments>/<block-id>
```


## Block files

Each block is represented by a collection of files.


### The metadata file

The only mandatory file is the metadata file, `meta.seq.bin`. The file consists
of a metadata object in the CBOR format, followed by zero or more JSON CRDT
Patch objects encoded in `binary` format.

Locally applied patches, which have not been confirmed by the server yet, are
stored in the metadata file, called *frontier*. The new frontier patches can be
appended without rewriting the file.


### The model file

The model file, `model.crdt`, contains the latest server-side model in `binary`
format. It is the latest model (state, snapshot) that has been confirmed by the
server.


### The history files

There are two optional files which can track full or partial editing history
of the block. One file, the "past", grows back in time; the other file, the
"future", grows forward in time.


#### The past history file

The past history file, `past.seq.cbor.gz`, contains the older history of patches
and the starting document model. It grows backwards, until it reaches the
beginning of time. The history is encoded in the `Log` format, where the log
starts with some known model and then contains a sequence of patches.

The history can be treated as immutable, hence it is stored in a compressed
".gz" CBOR sequence file.


#### The future history file

The future history file, `future.seq.cbor`, contains the list of patches
starting from the point where the "past" history ends and runs until either
the "model" is reached, or terminates earlier if there is a gap in the history.
That gap can be loaded from the remote.

The "future" history does not contain the *frontier* stored in the metadata file.

The "future" history file grows forward in time. Once the frontier patches are
synced to the remote, they can be appended to the "future" history file,
hence the "future" history file is not compressed, as new patches can be
appended without rewriting the file.
