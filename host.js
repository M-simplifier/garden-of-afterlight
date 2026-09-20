var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// web/host/node_modules/@bjorn3/browser_wasi_shim/dist/wasi_defs.js
var wasi_defs_exports = {};
__export(wasi_defs_exports, {
  ADVICE_DONTNEED: () => ADVICE_DONTNEED,
  ADVICE_NOREUSE: () => ADVICE_NOREUSE,
  ADVICE_NORMAL: () => ADVICE_NORMAL,
  ADVICE_RANDOM: () => ADVICE_RANDOM,
  ADVICE_SEQUENTIAL: () => ADVICE_SEQUENTIAL,
  ADVICE_WILLNEED: () => ADVICE_WILLNEED,
  CLOCKID_MONOTONIC: () => CLOCKID_MONOTONIC,
  CLOCKID_PROCESS_CPUTIME_ID: () => CLOCKID_PROCESS_CPUTIME_ID,
  CLOCKID_REALTIME: () => CLOCKID_REALTIME,
  CLOCKID_THREAD_CPUTIME_ID: () => CLOCKID_THREAD_CPUTIME_ID,
  Ciovec: () => Ciovec,
  Dirent: () => Dirent,
  ERRNO_2BIG: () => ERRNO_2BIG,
  ERRNO_ACCES: () => ERRNO_ACCES,
  ERRNO_ADDRINUSE: () => ERRNO_ADDRINUSE,
  ERRNO_ADDRNOTAVAIL: () => ERRNO_ADDRNOTAVAIL,
  ERRNO_AFNOSUPPORT: () => ERRNO_AFNOSUPPORT,
  ERRNO_AGAIN: () => ERRNO_AGAIN,
  ERRNO_ALREADY: () => ERRNO_ALREADY,
  ERRNO_BADF: () => ERRNO_BADF,
  ERRNO_BADMSG: () => ERRNO_BADMSG,
  ERRNO_BUSY: () => ERRNO_BUSY,
  ERRNO_CANCELED: () => ERRNO_CANCELED,
  ERRNO_CHILD: () => ERRNO_CHILD,
  ERRNO_CONNABORTED: () => ERRNO_CONNABORTED,
  ERRNO_CONNREFUSED: () => ERRNO_CONNREFUSED,
  ERRNO_CONNRESET: () => ERRNO_CONNRESET,
  ERRNO_DEADLK: () => ERRNO_DEADLK,
  ERRNO_DESTADDRREQ: () => ERRNO_DESTADDRREQ,
  ERRNO_DOM: () => ERRNO_DOM,
  ERRNO_DQUOT: () => ERRNO_DQUOT,
  ERRNO_EXIST: () => ERRNO_EXIST,
  ERRNO_FAULT: () => ERRNO_FAULT,
  ERRNO_FBIG: () => ERRNO_FBIG,
  ERRNO_HOSTUNREACH: () => ERRNO_HOSTUNREACH,
  ERRNO_IDRM: () => ERRNO_IDRM,
  ERRNO_ILSEQ: () => ERRNO_ILSEQ,
  ERRNO_INPROGRESS: () => ERRNO_INPROGRESS,
  ERRNO_INTR: () => ERRNO_INTR,
  ERRNO_INVAL: () => ERRNO_INVAL,
  ERRNO_IO: () => ERRNO_IO,
  ERRNO_ISCONN: () => ERRNO_ISCONN,
  ERRNO_ISDIR: () => ERRNO_ISDIR,
  ERRNO_LOOP: () => ERRNO_LOOP,
  ERRNO_MFILE: () => ERRNO_MFILE,
  ERRNO_MLINK: () => ERRNO_MLINK,
  ERRNO_MSGSIZE: () => ERRNO_MSGSIZE,
  ERRNO_MULTIHOP: () => ERRNO_MULTIHOP,
  ERRNO_NAMETOOLONG: () => ERRNO_NAMETOOLONG,
  ERRNO_NETDOWN: () => ERRNO_NETDOWN,
  ERRNO_NETRESET: () => ERRNO_NETRESET,
  ERRNO_NETUNREACH: () => ERRNO_NETUNREACH,
  ERRNO_NFILE: () => ERRNO_NFILE,
  ERRNO_NOBUFS: () => ERRNO_NOBUFS,
  ERRNO_NODEV: () => ERRNO_NODEV,
  ERRNO_NOENT: () => ERRNO_NOENT,
  ERRNO_NOEXEC: () => ERRNO_NOEXEC,
  ERRNO_NOLCK: () => ERRNO_NOLCK,
  ERRNO_NOLINK: () => ERRNO_NOLINK,
  ERRNO_NOMEM: () => ERRNO_NOMEM,
  ERRNO_NOMSG: () => ERRNO_NOMSG,
  ERRNO_NOPROTOOPT: () => ERRNO_NOPROTOOPT,
  ERRNO_NOSPC: () => ERRNO_NOSPC,
  ERRNO_NOSYS: () => ERRNO_NOSYS,
  ERRNO_NOTCAPABLE: () => ERRNO_NOTCAPABLE,
  ERRNO_NOTCONN: () => ERRNO_NOTCONN,
  ERRNO_NOTDIR: () => ERRNO_NOTDIR,
  ERRNO_NOTEMPTY: () => ERRNO_NOTEMPTY,
  ERRNO_NOTRECOVERABLE: () => ERRNO_NOTRECOVERABLE,
  ERRNO_NOTSOCK: () => ERRNO_NOTSOCK,
  ERRNO_NOTSUP: () => ERRNO_NOTSUP,
  ERRNO_NOTTY: () => ERRNO_NOTTY,
  ERRNO_NXIO: () => ERRNO_NXIO,
  ERRNO_OVERFLOW: () => ERRNO_OVERFLOW,
  ERRNO_OWNERDEAD: () => ERRNO_OWNERDEAD,
  ERRNO_PERM: () => ERRNO_PERM,
  ERRNO_PIPE: () => ERRNO_PIPE,
  ERRNO_PROTO: () => ERRNO_PROTO,
  ERRNO_PROTONOSUPPORT: () => ERRNO_PROTONOSUPPORT,
  ERRNO_PROTOTYPE: () => ERRNO_PROTOTYPE,
  ERRNO_RANGE: () => ERRNO_RANGE,
  ERRNO_ROFS: () => ERRNO_ROFS,
  ERRNO_SPIPE: () => ERRNO_SPIPE,
  ERRNO_SRCH: () => ERRNO_SRCH,
  ERRNO_STALE: () => ERRNO_STALE,
  ERRNO_SUCCESS: () => ERRNO_SUCCESS,
  ERRNO_TIMEDOUT: () => ERRNO_TIMEDOUT,
  ERRNO_TXTBSY: () => ERRNO_TXTBSY,
  ERRNO_XDEV: () => ERRNO_XDEV,
  EVENTRWFLAGS_FD_READWRITE_HANGUP: () => EVENTRWFLAGS_FD_READWRITE_HANGUP,
  EVENTTYPE_CLOCK: () => EVENTTYPE_CLOCK,
  EVENTTYPE_FD_READ: () => EVENTTYPE_FD_READ,
  EVENTTYPE_FD_WRITE: () => EVENTTYPE_FD_WRITE,
  Event: () => Event,
  FDFLAGS_APPEND: () => FDFLAGS_APPEND,
  FDFLAGS_DSYNC: () => FDFLAGS_DSYNC,
  FDFLAGS_NONBLOCK: () => FDFLAGS_NONBLOCK,
  FDFLAGS_RSYNC: () => FDFLAGS_RSYNC,
  FDFLAGS_SYNC: () => FDFLAGS_SYNC,
  FD_STDERR: () => FD_STDERR,
  FD_STDIN: () => FD_STDIN,
  FD_STDOUT: () => FD_STDOUT,
  FILETYPE_BLOCK_DEVICE: () => FILETYPE_BLOCK_DEVICE,
  FILETYPE_CHARACTER_DEVICE: () => FILETYPE_CHARACTER_DEVICE,
  FILETYPE_DIRECTORY: () => FILETYPE_DIRECTORY,
  FILETYPE_REGULAR_FILE: () => FILETYPE_REGULAR_FILE,
  FILETYPE_SOCKET_DGRAM: () => FILETYPE_SOCKET_DGRAM,
  FILETYPE_SOCKET_STREAM: () => FILETYPE_SOCKET_STREAM,
  FILETYPE_SYMBOLIC_LINK: () => FILETYPE_SYMBOLIC_LINK,
  FILETYPE_UNKNOWN: () => FILETYPE_UNKNOWN,
  FSTFLAGS_ATIM: () => FSTFLAGS_ATIM,
  FSTFLAGS_ATIM_NOW: () => FSTFLAGS_ATIM_NOW,
  FSTFLAGS_MTIM: () => FSTFLAGS_MTIM,
  FSTFLAGS_MTIM_NOW: () => FSTFLAGS_MTIM_NOW,
  Fdstat: () => Fdstat,
  Filestat: () => Filestat,
  Iovec: () => Iovec,
  OFLAGS_CREAT: () => OFLAGS_CREAT,
  OFLAGS_DIRECTORY: () => OFLAGS_DIRECTORY,
  OFLAGS_EXCL: () => OFLAGS_EXCL,
  OFLAGS_TRUNC: () => OFLAGS_TRUNC,
  PREOPENTYPE_DIR: () => PREOPENTYPE_DIR,
  Prestat: () => Prestat,
  PrestatDir: () => PrestatDir,
  RIFLAGS_RECV_PEEK: () => RIFLAGS_RECV_PEEK,
  RIFLAGS_RECV_WAITALL: () => RIFLAGS_RECV_WAITALL,
  RIGHTS_FD_ADVISE: () => RIGHTS_FD_ADVISE,
  RIGHTS_FD_ALLOCATE: () => RIGHTS_FD_ALLOCATE,
  RIGHTS_FD_DATASYNC: () => RIGHTS_FD_DATASYNC,
  RIGHTS_FD_FDSTAT_SET_FLAGS: () => RIGHTS_FD_FDSTAT_SET_FLAGS,
  RIGHTS_FD_FILESTAT_GET: () => RIGHTS_FD_FILESTAT_GET,
  RIGHTS_FD_FILESTAT_SET_SIZE: () => RIGHTS_FD_FILESTAT_SET_SIZE,
  RIGHTS_FD_FILESTAT_SET_TIMES: () => RIGHTS_FD_FILESTAT_SET_TIMES,
  RIGHTS_FD_READ: () => RIGHTS_FD_READ,
  RIGHTS_FD_READDIR: () => RIGHTS_FD_READDIR,
  RIGHTS_FD_SEEK: () => RIGHTS_FD_SEEK,
  RIGHTS_FD_SYNC: () => RIGHTS_FD_SYNC,
  RIGHTS_FD_TELL: () => RIGHTS_FD_TELL,
  RIGHTS_FD_WRITE: () => RIGHTS_FD_WRITE,
  RIGHTS_PATH_CREATE_DIRECTORY: () => RIGHTS_PATH_CREATE_DIRECTORY,
  RIGHTS_PATH_CREATE_FILE: () => RIGHTS_PATH_CREATE_FILE,
  RIGHTS_PATH_FILESTAT_GET: () => RIGHTS_PATH_FILESTAT_GET,
  RIGHTS_PATH_FILESTAT_SET_SIZE: () => RIGHTS_PATH_FILESTAT_SET_SIZE,
  RIGHTS_PATH_FILESTAT_SET_TIMES: () => RIGHTS_PATH_FILESTAT_SET_TIMES,
  RIGHTS_PATH_LINK_SOURCE: () => RIGHTS_PATH_LINK_SOURCE,
  RIGHTS_PATH_LINK_TARGET: () => RIGHTS_PATH_LINK_TARGET,
  RIGHTS_PATH_OPEN: () => RIGHTS_PATH_OPEN,
  RIGHTS_PATH_READLINK: () => RIGHTS_PATH_READLINK,
  RIGHTS_PATH_REMOVE_DIRECTORY: () => RIGHTS_PATH_REMOVE_DIRECTORY,
  RIGHTS_PATH_RENAME_SOURCE: () => RIGHTS_PATH_RENAME_SOURCE,
  RIGHTS_PATH_RENAME_TARGET: () => RIGHTS_PATH_RENAME_TARGET,
  RIGHTS_PATH_SYMLINK: () => RIGHTS_PATH_SYMLINK,
  RIGHTS_PATH_UNLINK_FILE: () => RIGHTS_PATH_UNLINK_FILE,
  RIGHTS_POLL_FD_READWRITE: () => RIGHTS_POLL_FD_READWRITE,
  RIGHTS_SOCK_SHUTDOWN: () => RIGHTS_SOCK_SHUTDOWN,
  ROFLAGS_RECV_DATA_TRUNCATED: () => ROFLAGS_RECV_DATA_TRUNCATED,
  SDFLAGS_RD: () => SDFLAGS_RD,
  SDFLAGS_WR: () => SDFLAGS_WR,
  SIGNAL_ABRT: () => SIGNAL_ABRT,
  SIGNAL_ALRM: () => SIGNAL_ALRM,
  SIGNAL_BUS: () => SIGNAL_BUS,
  SIGNAL_CHLD: () => SIGNAL_CHLD,
  SIGNAL_CONT: () => SIGNAL_CONT,
  SIGNAL_FPE: () => SIGNAL_FPE,
  SIGNAL_HUP: () => SIGNAL_HUP,
  SIGNAL_ILL: () => SIGNAL_ILL,
  SIGNAL_INT: () => SIGNAL_INT,
  SIGNAL_KILL: () => SIGNAL_KILL,
  SIGNAL_NONE: () => SIGNAL_NONE,
  SIGNAL_PIPE: () => SIGNAL_PIPE,
  SIGNAL_POLL: () => SIGNAL_POLL,
  SIGNAL_PROF: () => SIGNAL_PROF,
  SIGNAL_PWR: () => SIGNAL_PWR,
  SIGNAL_QUIT: () => SIGNAL_QUIT,
  SIGNAL_SEGV: () => SIGNAL_SEGV,
  SIGNAL_STOP: () => SIGNAL_STOP,
  SIGNAL_SYS: () => SIGNAL_SYS,
  SIGNAL_TERM: () => SIGNAL_TERM,
  SIGNAL_TRAP: () => SIGNAL_TRAP,
  SIGNAL_TSTP: () => SIGNAL_TSTP,
  SIGNAL_TTIN: () => SIGNAL_TTIN,
  SIGNAL_TTOU: () => SIGNAL_TTOU,
  SIGNAL_URG: () => SIGNAL_URG,
  SIGNAL_USR1: () => SIGNAL_USR1,
  SIGNAL_USR2: () => SIGNAL_USR2,
  SIGNAL_VTALRM: () => SIGNAL_VTALRM,
  SIGNAL_WINCH: () => SIGNAL_WINCH,
  SIGNAL_XCPU: () => SIGNAL_XCPU,
  SIGNAL_XFSZ: () => SIGNAL_XFSZ,
  SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME: () => SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME,
  Subscription: () => Subscription,
  WHENCE_CUR: () => WHENCE_CUR,
  WHENCE_END: () => WHENCE_END,
  WHENCE_SET: () => WHENCE_SET
});
var FD_STDIN = 0;
var FD_STDOUT = 1;
var FD_STDERR = 2;
var CLOCKID_REALTIME = 0;
var CLOCKID_MONOTONIC = 1;
var CLOCKID_PROCESS_CPUTIME_ID = 2;
var CLOCKID_THREAD_CPUTIME_ID = 3;
var ERRNO_SUCCESS = 0;
var ERRNO_2BIG = 1;
var ERRNO_ACCES = 2;
var ERRNO_ADDRINUSE = 3;
var ERRNO_ADDRNOTAVAIL = 4;
var ERRNO_AFNOSUPPORT = 5;
var ERRNO_AGAIN = 6;
var ERRNO_ALREADY = 7;
var ERRNO_BADF = 8;
var ERRNO_BADMSG = 9;
var ERRNO_BUSY = 10;
var ERRNO_CANCELED = 11;
var ERRNO_CHILD = 12;
var ERRNO_CONNABORTED = 13;
var ERRNO_CONNREFUSED = 14;
var ERRNO_CONNRESET = 15;
var ERRNO_DEADLK = 16;
var ERRNO_DESTADDRREQ = 17;
var ERRNO_DOM = 18;
var ERRNO_DQUOT = 19;
var ERRNO_EXIST = 20;
var ERRNO_FAULT = 21;
var ERRNO_FBIG = 22;
var ERRNO_HOSTUNREACH = 23;
var ERRNO_IDRM = 24;
var ERRNO_ILSEQ = 25;
var ERRNO_INPROGRESS = 26;
var ERRNO_INTR = 27;
var ERRNO_INVAL = 28;
var ERRNO_IO = 29;
var ERRNO_ISCONN = 30;
var ERRNO_ISDIR = 31;
var ERRNO_LOOP = 32;
var ERRNO_MFILE = 33;
var ERRNO_MLINK = 34;
var ERRNO_MSGSIZE = 35;
var ERRNO_MULTIHOP = 36;
var ERRNO_NAMETOOLONG = 37;
var ERRNO_NETDOWN = 38;
var ERRNO_NETRESET = 39;
var ERRNO_NETUNREACH = 40;
var ERRNO_NFILE = 41;
var ERRNO_NOBUFS = 42;
var ERRNO_NODEV = 43;
var ERRNO_NOENT = 44;
var ERRNO_NOEXEC = 45;
var ERRNO_NOLCK = 46;
var ERRNO_NOLINK = 47;
var ERRNO_NOMEM = 48;
var ERRNO_NOMSG = 49;
var ERRNO_NOPROTOOPT = 50;
var ERRNO_NOSPC = 51;
var ERRNO_NOSYS = 52;
var ERRNO_NOTCONN = 53;
var ERRNO_NOTDIR = 54;
var ERRNO_NOTEMPTY = 55;
var ERRNO_NOTRECOVERABLE = 56;
var ERRNO_NOTSOCK = 57;
var ERRNO_NOTSUP = 58;
var ERRNO_NOTTY = 59;
var ERRNO_NXIO = 60;
var ERRNO_OVERFLOW = 61;
var ERRNO_OWNERDEAD = 62;
var ERRNO_PERM = 63;
var ERRNO_PIPE = 64;
var ERRNO_PROTO = 65;
var ERRNO_PROTONOSUPPORT = 66;
var ERRNO_PROTOTYPE = 67;
var ERRNO_RANGE = 68;
var ERRNO_ROFS = 69;
var ERRNO_SPIPE = 70;
var ERRNO_SRCH = 71;
var ERRNO_STALE = 72;
var ERRNO_TIMEDOUT = 73;
var ERRNO_TXTBSY = 74;
var ERRNO_XDEV = 75;
var ERRNO_NOTCAPABLE = 76;
var RIGHTS_FD_DATASYNC = 1 << 0;
var RIGHTS_FD_READ = 1 << 1;
var RIGHTS_FD_SEEK = 1 << 2;
var RIGHTS_FD_FDSTAT_SET_FLAGS = 1 << 3;
var RIGHTS_FD_SYNC = 1 << 4;
var RIGHTS_FD_TELL = 1 << 5;
var RIGHTS_FD_WRITE = 1 << 6;
var RIGHTS_FD_ADVISE = 1 << 7;
var RIGHTS_FD_ALLOCATE = 1 << 8;
var RIGHTS_PATH_CREATE_DIRECTORY = 1 << 9;
var RIGHTS_PATH_CREATE_FILE = 1 << 10;
var RIGHTS_PATH_LINK_SOURCE = 1 << 11;
var RIGHTS_PATH_LINK_TARGET = 1 << 12;
var RIGHTS_PATH_OPEN = 1 << 13;
var RIGHTS_FD_READDIR = 1 << 14;
var RIGHTS_PATH_READLINK = 1 << 15;
var RIGHTS_PATH_RENAME_SOURCE = 1 << 16;
var RIGHTS_PATH_RENAME_TARGET = 1 << 17;
var RIGHTS_PATH_FILESTAT_GET = 1 << 18;
var RIGHTS_PATH_FILESTAT_SET_SIZE = 1 << 19;
var RIGHTS_PATH_FILESTAT_SET_TIMES = 1 << 20;
var RIGHTS_FD_FILESTAT_GET = 1 << 21;
var RIGHTS_FD_FILESTAT_SET_SIZE = 1 << 22;
var RIGHTS_FD_FILESTAT_SET_TIMES = 1 << 23;
var RIGHTS_PATH_SYMLINK = 1 << 24;
var RIGHTS_PATH_REMOVE_DIRECTORY = 1 << 25;
var RIGHTS_PATH_UNLINK_FILE = 1 << 26;
var RIGHTS_POLL_FD_READWRITE = 1 << 27;
var RIGHTS_SOCK_SHUTDOWN = 1 << 28;
var Iovec = class _Iovec {
  static read_bytes(view, ptr) {
    const iovec = new _Iovec();
    iovec.buf = view.getUint32(ptr, true);
    iovec.buf_len = view.getUint32(ptr + 4, true);
    return iovec;
  }
  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(_Iovec.read_bytes(view, ptr + 8 * i));
    }
    return iovecs;
  }
};
var Ciovec = class _Ciovec {
  static read_bytes(view, ptr) {
    const iovec = new _Ciovec();
    iovec.buf = view.getUint32(ptr, true);
    iovec.buf_len = view.getUint32(ptr + 4, true);
    return iovec;
  }
  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(_Ciovec.read_bytes(view, ptr + 8 * i));
    }
    return iovecs;
  }
};
var WHENCE_SET = 0;
var WHENCE_CUR = 1;
var WHENCE_END = 2;
var FILETYPE_UNKNOWN = 0;
var FILETYPE_BLOCK_DEVICE = 1;
var FILETYPE_CHARACTER_DEVICE = 2;
var FILETYPE_DIRECTORY = 3;
var FILETYPE_REGULAR_FILE = 4;
var FILETYPE_SOCKET_DGRAM = 5;
var FILETYPE_SOCKET_STREAM = 6;
var FILETYPE_SYMBOLIC_LINK = 7;
var Dirent = class {
  head_length() {
    return 24;
  }
  name_length() {
    return this.dir_name.byteLength;
  }
  write_head_bytes(view, ptr) {
    view.setBigUint64(ptr, this.d_next, true);
    view.setBigUint64(ptr + 8, this.d_ino, true);
    view.setUint32(ptr + 16, this.dir_name.length, true);
    view.setUint8(ptr + 20, this.d_type);
  }
  write_name_bytes(view8, ptr, buf_len) {
    view8.set(this.dir_name.slice(0, Math.min(this.dir_name.byteLength, buf_len)), ptr);
  }
  constructor(next_cookie, d_ino, name, type) {
    const encoded_name = new TextEncoder().encode(name);
    this.d_next = next_cookie;
    this.d_ino = d_ino;
    this.d_namlen = encoded_name.byteLength;
    this.d_type = type;
    this.dir_name = encoded_name;
  }
};
var ADVICE_NORMAL = 0;
var ADVICE_SEQUENTIAL = 1;
var ADVICE_RANDOM = 2;
var ADVICE_WILLNEED = 3;
var ADVICE_DONTNEED = 4;
var ADVICE_NOREUSE = 5;
var FDFLAGS_APPEND = 1 << 0;
var FDFLAGS_DSYNC = 1 << 1;
var FDFLAGS_NONBLOCK = 1 << 2;
var FDFLAGS_RSYNC = 1 << 3;
var FDFLAGS_SYNC = 1 << 4;
var Fdstat = class {
  write_bytes(view, ptr) {
    view.setUint8(ptr, this.fs_filetype);
    view.setUint16(ptr + 2, this.fs_flags, true);
    view.setBigUint64(ptr + 8, this.fs_rights_base, true);
    view.setBigUint64(ptr + 16, this.fs_rights_inherited, true);
  }
  constructor(filetype, flags) {
    this.fs_rights_base = 0n;
    this.fs_rights_inherited = 0n;
    this.fs_filetype = filetype;
    this.fs_flags = flags;
  }
};
var FSTFLAGS_ATIM = 1 << 0;
var FSTFLAGS_ATIM_NOW = 1 << 1;
var FSTFLAGS_MTIM = 1 << 2;
var FSTFLAGS_MTIM_NOW = 1 << 3;
var OFLAGS_CREAT = 1 << 0;
var OFLAGS_DIRECTORY = 1 << 1;
var OFLAGS_EXCL = 1 << 2;
var OFLAGS_TRUNC = 1 << 3;
var Filestat = class {
  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.dev, true);
    view.setBigUint64(ptr + 8, this.ino, true);
    view.setUint8(ptr + 16, this.filetype);
    view.setBigUint64(ptr + 24, this.nlink, true);
    view.setBigUint64(ptr + 32, this.size, true);
    view.setBigUint64(ptr + 38, this.atim, true);
    view.setBigUint64(ptr + 46, this.mtim, true);
    view.setBigUint64(ptr + 52, this.ctim, true);
  }
  constructor(ino, filetype, size) {
    this.dev = 0n;
    this.nlink = 0n;
    this.atim = 0n;
    this.mtim = 0n;
    this.ctim = 0n;
    this.ino = ino;
    this.filetype = filetype;
    this.size = size;
  }
};
var EVENTTYPE_CLOCK = 0;
var EVENTTYPE_FD_READ = 1;
var EVENTTYPE_FD_WRITE = 2;
var EVENTRWFLAGS_FD_READWRITE_HANGUP = 1 << 0;
var SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME = 1 << 0;
var Subscription = class _Subscription {
  static read_bytes(view, ptr) {
    return new _Subscription(view.getBigUint64(ptr, true), view.getUint8(ptr + 8), view.getUint32(ptr + 16, true), view.getBigUint64(ptr + 24, true), view.getUint16(ptr + 36, true));
  }
  constructor(userdata, eventtype, clockid, timeout, flags) {
    this.userdata = userdata;
    this.eventtype = eventtype;
    this.clockid = clockid;
    this.timeout = timeout;
    this.flags = flags;
  }
};
var Event = class {
  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.userdata, true);
    view.setUint16(ptr + 8, this.error, true);
    view.setUint8(ptr + 10, this.eventtype);
  }
  constructor(userdata, error, eventtype) {
    this.userdata = userdata;
    this.error = error;
    this.eventtype = eventtype;
  }
};
var SIGNAL_NONE = 0;
var SIGNAL_HUP = 1;
var SIGNAL_INT = 2;
var SIGNAL_QUIT = 3;
var SIGNAL_ILL = 4;
var SIGNAL_TRAP = 5;
var SIGNAL_ABRT = 6;
var SIGNAL_BUS = 7;
var SIGNAL_FPE = 8;
var SIGNAL_KILL = 9;
var SIGNAL_USR1 = 10;
var SIGNAL_SEGV = 11;
var SIGNAL_USR2 = 12;
var SIGNAL_PIPE = 13;
var SIGNAL_ALRM = 14;
var SIGNAL_TERM = 15;
var SIGNAL_CHLD = 16;
var SIGNAL_CONT = 17;
var SIGNAL_STOP = 18;
var SIGNAL_TSTP = 19;
var SIGNAL_TTIN = 20;
var SIGNAL_TTOU = 21;
var SIGNAL_URG = 22;
var SIGNAL_XCPU = 23;
var SIGNAL_XFSZ = 24;
var SIGNAL_VTALRM = 25;
var SIGNAL_PROF = 26;
var SIGNAL_WINCH = 27;
var SIGNAL_POLL = 28;
var SIGNAL_PWR = 29;
var SIGNAL_SYS = 30;
var RIFLAGS_RECV_PEEK = 1 << 0;
var RIFLAGS_RECV_WAITALL = 1 << 1;
var ROFLAGS_RECV_DATA_TRUNCATED = 1 << 0;
var SDFLAGS_RD = 1 << 0;
var SDFLAGS_WR = 1 << 1;
var PREOPENTYPE_DIR = 0;
var PrestatDir = class {
  write_bytes(view, ptr) {
    view.setUint32(ptr, this.pr_name.byteLength, true);
  }
  constructor(name) {
    this.pr_name = new TextEncoder().encode(name);
  }
};
var Prestat = class _Prestat {
  static dir(name) {
    const prestat = new _Prestat();
    prestat.tag = PREOPENTYPE_DIR;
    prestat.inner = new PrestatDir(name);
    return prestat;
  }
  write_bytes(view, ptr) {
    view.setUint32(ptr, this.tag, true);
    this.inner.write_bytes(view, ptr + 4);
  }
};

// web/host/node_modules/@bjorn3/browser_wasi_shim/dist/debug.js
var Debug = class Debug2 {
  enable(enabled) {
    this.log = createLogger(enabled === void 0 ? true : enabled, this.prefix);
  }
  get enabled() {
    return this.isEnabled;
  }
  constructor(isEnabled) {
    this.isEnabled = isEnabled;
    this.prefix = "wasi:";
    this.enable(isEnabled);
  }
};
function createLogger(enabled, prefix) {
  if (enabled) {
    const a = console.log.bind(console, "%c%s", "color: #265BA0", prefix);
    return a;
  } else {
    return () => {
    };
  }
}
var debug = new Debug(false);

// web/host/node_modules/@bjorn3/browser_wasi_shim/dist/wasi.js
var WASIProcExit = class extends Error {
  constructor(code) {
    super("exit with exit code " + code);
    this.code = code;
  }
};
var WASI = class WASI2 {
  start(instance2) {
    this.inst = instance2;
    try {
      instance2.exports._start();
      return 0;
    } catch (e) {
      if (e instanceof WASIProcExit) {
        return e.code;
      } else {
        throw e;
      }
    }
  }
  initialize(instance2) {
    this.inst = instance2;
    if (instance2.exports._initialize) {
      instance2.exports._initialize();
    }
  }
  constructor(args, env, fds, options = {}) {
    this.args = [];
    this.env = [];
    this.fds = [];
    debug.enable(options.debug);
    this.args = args;
    this.env = env;
    this.fds = fds;
    const self = this;
    this.wasiImport = { args_sizes_get(argc, argv_buf_size) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      buffer.setUint32(argc, self.args.length, true);
      let buf_size = 0;
      for (const arg of self.args) {
        buf_size += arg.length + 1;
      }
      buffer.setUint32(argv_buf_size, buf_size, true);
      debug.log(buffer.getUint32(argc, true), buffer.getUint32(argv_buf_size, true));
      return 0;
    }, args_get(argv, argv_buf) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      const orig_argv_buf = argv_buf;
      for (let i = 0; i < self.args.length; i++) {
        buffer.setUint32(argv, argv_buf, true);
        argv += 4;
        const arg = new TextEncoder().encode(self.args[i]);
        buffer8.set(arg, argv_buf);
        buffer.setUint8(argv_buf + arg.length, 0);
        argv_buf += arg.length + 1;
      }
      if (debug.enabled) {
        debug.log(new TextDecoder("utf-8").decode(buffer8.slice(orig_argv_buf, argv_buf)));
      }
      return 0;
    }, environ_sizes_get(environ_count, environ_size) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      buffer.setUint32(environ_count, self.env.length, true);
      let buf_size = 0;
      for (const environ of self.env) {
        buf_size += new TextEncoder().encode(environ).length + 1;
      }
      buffer.setUint32(environ_size, buf_size, true);
      debug.log(buffer.getUint32(environ_count, true), buffer.getUint32(environ_size, true));
      return 0;
    }, environ_get(environ, environ_buf) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      const orig_environ_buf = environ_buf;
      for (let i = 0; i < self.env.length; i++) {
        buffer.setUint32(environ, environ_buf, true);
        environ += 4;
        const e = new TextEncoder().encode(self.env[i]);
        buffer8.set(e, environ_buf);
        buffer.setUint8(environ_buf + e.length, 0);
        environ_buf += e.length + 1;
      }
      if (debug.enabled) {
        debug.log(new TextDecoder("utf-8").decode(buffer8.slice(orig_environ_buf, environ_buf)));
      }
      return 0;
    }, clock_res_get(id, res_ptr) {
      let resolutionValue;
      switch (id) {
        case CLOCKID_MONOTONIC: {
          resolutionValue = 5000n;
          break;
        }
        case CLOCKID_REALTIME: {
          resolutionValue = 1000000n;
          break;
        }
        default:
          return ERRNO_NOSYS;
      }
      const view = new DataView(self.inst.exports.memory.buffer);
      view.setBigUint64(res_ptr, resolutionValue, true);
      return ERRNO_SUCCESS;
    }, clock_time_get(id, precision, time) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (id === CLOCKID_REALTIME) {
        buffer.setBigUint64(time, BigInt((/* @__PURE__ */ new Date()).getTime()) * 1000000n, true);
      } else if (id == CLOCKID_MONOTONIC) {
        let monotonic_time;
        try {
          monotonic_time = BigInt(Math.round(performance.now() * 1e6));
        } catch (e) {
          monotonic_time = 0n;
        }
        buffer.setBigUint64(time, monotonic_time, true);
      } else {
        buffer.setBigUint64(time, 0n, true);
      }
      return 0;
    }, fd_advise(fd, offset, len, advice) {
      if (self.fds[fd] != void 0) {
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_allocate(fd, offset, len) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_allocate(offset, len);
      } else {
        return ERRNO_BADF;
      }
    }, fd_close(fd) {
      if (self.fds[fd] != void 0) {
        const ret = self.fds[fd].fd_close();
        self.fds[fd] = void 0;
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_datasync(fd) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_sync();
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_get(fd, fdstat_ptr) {
      if (self.fds[fd] != void 0) {
        const { ret, fdstat } = self.fds[fd].fd_fdstat_get();
        if (fdstat != null) {
          fdstat.write_bytes(new DataView(self.inst.exports.memory.buffer), fdstat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_set_flags(fd, flags) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_fdstat_set_flags(flags);
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting);
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_get(fd, filestat_ptr) {
      if (self.fds[fd] != void 0) {
        const { ret, filestat } = self.fds[fd].fd_filestat_get();
        if (filestat != null) {
          filestat.write_bytes(new DataView(self.inst.exports.memory.buffer), filestat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_set_size(fd, size) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_filestat_set_size(size);
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_set_times(fd, atim, mtim, fst_flags) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_filestat_set_times(atim, mtim, fst_flags);
      } else {
        return ERRNO_BADF;
      }
    }, fd_pread(fd, iovs_ptr, iovs_len, offset, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Iovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nread = 0;
        for (const iovec of iovecs) {
          const { ret, data } = self.fds[fd].fd_pread(iovec.buf_len, offset);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nread_ptr, nread, true);
            return ret;
          }
          buffer8.set(data, iovec.buf);
          nread += data.length;
          offset += BigInt(data.length);
          if (data.length != iovec.buf_len) {
            break;
          }
        }
        buffer.setUint32(nread_ptr, nread, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_prestat_get(fd, buf_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, prestat } = self.fds[fd].fd_prestat_get();
        if (prestat != null) {
          prestat.write_bytes(buffer, buf_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_prestat_dir_name(fd, path_ptr, path_len) {
      if (self.fds[fd] != void 0) {
        const { ret, prestat } = self.fds[fd].fd_prestat_get();
        if (prestat == null) {
          return ret;
        }
        const prestat_dir_name = prestat.inner.pr_name;
        const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
        buffer8.set(prestat_dir_name.slice(0, path_len), path_ptr);
        return prestat_dir_name.byteLength > path_len ? ERRNO_NAMETOOLONG : ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_pwrite(fd, iovs_ptr, iovs_len, offset, nwritten_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nwritten = 0;
        for (const iovec of iovecs) {
          const data = buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len);
          const { ret, nwritten: nwritten_part } = self.fds[fd].fd_pwrite(data, offset);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nwritten_ptr, nwritten, true);
            return ret;
          }
          nwritten += nwritten_part;
          offset += BigInt(nwritten_part);
          if (nwritten_part != data.byteLength) {
            break;
          }
        }
        buffer.setUint32(nwritten_ptr, nwritten, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_read(fd, iovs_ptr, iovs_len, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Iovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nread = 0;
        for (const iovec of iovecs) {
          const { ret, data } = self.fds[fd].fd_read(iovec.buf_len);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nread_ptr, nread, true);
            return ret;
          }
          buffer8.set(data, iovec.buf);
          nread += data.length;
          if (data.length != iovec.buf_len) {
            break;
          }
        }
        buffer.setUint32(nread_ptr, nread, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_readdir(fd, buf, buf_len, cookie, bufused_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        let bufused = 0;
        while (true) {
          const { ret, dirent } = self.fds[fd].fd_readdir_single(cookie);
          if (ret != 0) {
            buffer.setUint32(bufused_ptr, bufused, true);
            return ret;
          }
          if (dirent == null) {
            break;
          }
          if (buf_len - bufused < dirent.head_length()) {
            bufused = buf_len;
            break;
          }
          const head_bytes = new ArrayBuffer(dirent.head_length());
          dirent.write_head_bytes(new DataView(head_bytes), 0);
          buffer8.set(new Uint8Array(head_bytes).slice(0, Math.min(head_bytes.byteLength, buf_len - bufused)), buf);
          buf += dirent.head_length();
          bufused += dirent.head_length();
          if (buf_len - bufused < dirent.name_length()) {
            bufused = buf_len;
            break;
          }
          dirent.write_name_bytes(buffer8, buf, buf_len - bufused);
          buf += dirent.name_length();
          bufused += dirent.name_length();
          cookie = dirent.d_next;
        }
        buffer.setUint32(bufused_ptr, bufused, true);
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, fd_renumber(fd, to) {
      if (self.fds[fd] != void 0 && self.fds[to] != void 0) {
        const ret = self.fds[to].fd_close();
        if (ret != 0) {
          return ret;
        }
        self.fds[to] = self.fds[fd];
        self.fds[fd] = void 0;
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, fd_seek(fd, offset, whence, offset_out_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, offset: offset_out } = self.fds[fd].fd_seek(offset, whence);
        buffer.setBigInt64(offset_out_ptr, offset_out, true);
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_sync(fd) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_sync();
      } else {
        return ERRNO_BADF;
      }
    }, fd_tell(fd, offset_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, offset } = self.fds[fd].fd_tell();
        buffer.setBigUint64(offset_ptr, offset, true);
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nwritten = 0;
        for (const iovec of iovecs) {
          const data = buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len);
          const { ret, nwritten: nwritten_part } = self.fds[fd].fd_write(data);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nwritten_ptr, nwritten, true);
            return ret;
          }
          nwritten += nwritten_part;
          if (nwritten_part != data.byteLength) {
            break;
          }
        }
        buffer.setUint32(nwritten_ptr, nwritten, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, path_create_directory(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_create_directory(path);
      } else {
        return ERRNO_BADF;
      }
    }, path_filestat_get(fd, flags, path_ptr, path_len, filestat_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        const { ret, filestat } = self.fds[fd].path_filestat_get(flags, path);
        if (filestat != null) {
          filestat.write_bytes(buffer, filestat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_filestat_set_times(fd, flags, path_ptr, path_len, atim, mtim, fst_flags) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_filestat_set_times(flags, path, atim, mtim, fst_flags);
      } else {
        return ERRNO_BADF;
      }
    }, path_link(old_fd, old_flags, old_path_ptr, old_path_len, new_fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[old_fd] != void 0 && self.fds[new_fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        const { ret, inode_obj } = self.fds[old_fd].path_lookup(old_path, old_flags);
        if (inode_obj == null) {
          return ret;
        }
        return self.fds[new_fd].path_link(new_path, inode_obj, false);
      } else {
        return ERRNO_BADF;
      }
    }, path_open(fd, dirflags, path_ptr, path_len, oflags, fs_rights_base, fs_rights_inheriting, fd_flags, opened_fd_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        debug.log(path);
        const { ret, fd_obj } = self.fds[fd].path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags);
        if (ret != 0) {
          return ret;
        }
        self.fds.push(fd_obj);
        const opened_fd = self.fds.length - 1;
        buffer.setUint32(opened_fd_ptr, opened_fd, true);
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, path_readlink(fd, path_ptr, path_len, buf_ptr, buf_len, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        debug.log(path);
        const { ret, data } = self.fds[fd].path_readlink(path);
        if (data != null) {
          const data_buf = new TextEncoder().encode(data);
          if (data_buf.length > buf_len) {
            buffer.setUint32(nread_ptr, 0, true);
            return ERRNO_BADF;
          }
          buffer8.set(data_buf, buf_ptr);
          buffer.setUint32(nread_ptr, data_buf.length, true);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_remove_directory(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_remove_directory(path);
      } else {
        return ERRNO_BADF;
      }
    }, path_rename(fd, old_path_ptr, old_path_len, new_fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0 && self.fds[new_fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        let { ret, inode_obj } = self.fds[fd].path_unlink(old_path);
        if (inode_obj == null) {
          return ret;
        }
        ret = self.fds[new_fd].path_link(new_path, inode_obj, true);
        if (ret != ERRNO_SUCCESS) {
          if (self.fds[fd].path_link(old_path, inode_obj, true) != ERRNO_SUCCESS) {
            throw "path_link should always return success when relinking an inode back to the original place";
          }
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_symlink(old_path_ptr, old_path_len, fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        return ERRNO_NOTSUP;
      } else {
        return ERRNO_BADF;
      }
    }, path_unlink_file(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_unlink_file(path);
      } else {
        return ERRNO_BADF;
      }
    }, poll_oneoff(in_ptr, out_ptr, nsubscriptions) {
      if (nsubscriptions === 0) {
        return ERRNO_INVAL;
      }
      if (nsubscriptions > 1) {
        debug.log("poll_oneoff: only a single subscription is supported");
        return ERRNO_NOTSUP;
      }
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const s = Subscription.read_bytes(buffer, in_ptr);
      const eventtype = s.eventtype;
      const clockid = s.clockid;
      const timeout = s.timeout;
      if (eventtype !== EVENTTYPE_CLOCK) {
        debug.log("poll_oneoff: only clock subscriptions are supported");
        return ERRNO_NOTSUP;
      }
      let getNow = void 0;
      if (clockid === CLOCKID_MONOTONIC) {
        getNow = () => BigInt(Math.round(performance.now() * 1e6));
      } else if (clockid === CLOCKID_REALTIME) {
        getNow = () => BigInt((/* @__PURE__ */ new Date()).getTime()) * 1000000n;
      } else {
        return ERRNO_INVAL;
      }
      const endTime = (s.flags & SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME) !== 0 ? timeout : getNow() + timeout;
      while (endTime > getNow()) {
      }
      const event = new Event(s.userdata, ERRNO_SUCCESS, eventtype);
      event.write_bytes(buffer, out_ptr);
      return ERRNO_SUCCESS;
    }, proc_exit(exit_code) {
      throw new WASIProcExit(exit_code);
    }, proc_raise(sig) {
      throw "raised signal " + sig;
    }, sched_yield() {
    }, random_get(buf, buf_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer).subarray(buf, buf + buf_len);
      if ("crypto" in globalThis && (typeof SharedArrayBuffer === "undefined" || !(self.inst.exports.memory.buffer instanceof SharedArrayBuffer))) {
        for (let i = 0; i < buf_len; i += 65536) {
          crypto.getRandomValues(buffer8.subarray(i, i + 65536));
        }
      } else {
        for (let i = 0; i < buf_len; i++) {
          buffer8[i] = Math.random() * 256 | 0;
        }
      }
    }, sock_recv(fd, ri_data, ri_flags) {
      throw "sockets not supported";
    }, sock_send(fd, si_data, si_flags) {
      throw "sockets not supported";
    }, sock_shutdown(fd, how) {
      throw "sockets not supported";
    }, sock_accept(fd, flags) {
      throw "sockets not supported";
    } };
  }
};

// web/host/node_modules/@bjorn3/browser_wasi_shim/dist/fd.js
var Fd = class {
  fd_allocate(offset, len) {
    return ERRNO_NOTSUP;
  }
  fd_close() {
    return 0;
  }
  fd_fdstat_get() {
    return { ret: ERRNO_NOTSUP, fdstat: null };
  }
  fd_fdstat_set_flags(flags) {
    return ERRNO_NOTSUP;
  }
  fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting) {
    return ERRNO_NOTSUP;
  }
  fd_filestat_get() {
    return { ret: ERRNO_NOTSUP, filestat: null };
  }
  fd_filestat_set_size(size) {
    return ERRNO_NOTSUP;
  }
  fd_filestat_set_times(atim, mtim, fst_flags) {
    return ERRNO_NOTSUP;
  }
  fd_pread(size, offset) {
    return { ret: ERRNO_NOTSUP, data: new Uint8Array() };
  }
  fd_prestat_get() {
    return { ret: ERRNO_NOTSUP, prestat: null };
  }
  fd_pwrite(data, offset) {
    return { ret: ERRNO_NOTSUP, nwritten: 0 };
  }
  fd_read(size) {
    return { ret: ERRNO_NOTSUP, data: new Uint8Array() };
  }
  fd_readdir_single(cookie) {
    return { ret: ERRNO_NOTSUP, dirent: null };
  }
  fd_seek(offset, whence) {
    return { ret: ERRNO_NOTSUP, offset: 0n };
  }
  fd_sync() {
    return 0;
  }
  fd_tell() {
    return { ret: ERRNO_NOTSUP, offset: 0n };
  }
  fd_write(data) {
    return { ret: ERRNO_NOTSUP, nwritten: 0 };
  }
  path_create_directory(path) {
    return ERRNO_NOTSUP;
  }
  path_filestat_get(flags, path) {
    return { ret: ERRNO_NOTSUP, filestat: null };
  }
  path_filestat_set_times(flags, path, atim, mtim, fst_flags) {
    return ERRNO_NOTSUP;
  }
  path_link(path, inode, allow_dir) {
    return ERRNO_NOTSUP;
  }
  path_unlink(path) {
    return { ret: ERRNO_NOTSUP, inode_obj: null };
  }
  path_lookup(path, dirflags) {
    return { ret: ERRNO_NOTSUP, inode_obj: null };
  }
  path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    return { ret: ERRNO_NOTDIR, fd_obj: null };
  }
  path_readlink(path) {
    return { ret: ERRNO_NOTSUP, data: null };
  }
  path_remove_directory(path) {
    return ERRNO_NOTSUP;
  }
  path_rename(old_path, new_fd, new_path) {
    return ERRNO_NOTSUP;
  }
  path_unlink_file(path) {
    return ERRNO_NOTSUP;
  }
};
var Inode = class _Inode {
  static issue_ino() {
    return _Inode.next_ino++;
  }
  static root_ino() {
    return 0n;
  }
  constructor() {
    this.ino = _Inode.issue_ino();
  }
};
Inode.next_ino = 1n;

// web/host/node_modules/@bjorn3/browser_wasi_shim/dist/fs_mem.js
var OpenFile = class extends Fd {
  fd_allocate(offset, len) {
    if (this.file.size > offset + len) {
    } else {
      const new_data = new Uint8Array(Number(offset + len));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return ERRNO_SUCCESS;
  }
  fd_fdstat_get() {
    return { ret: 0, fdstat: new Fdstat(FILETYPE_REGULAR_FILE, 0) };
  }
  fd_filestat_set_size(size) {
    if (this.file.size > size) {
      this.file.data = new Uint8Array(this.file.data.buffer.slice(0, Number(size)));
    } else {
      const new_data = new Uint8Array(Number(size));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return ERRNO_SUCCESS;
  }
  fd_read(size) {
    const slice = this.file.data.slice(Number(this.file_pos), Number(this.file_pos + BigInt(size)));
    this.file_pos += BigInt(slice.length);
    return { ret: 0, data: slice };
  }
  fd_pread(size, offset) {
    const slice = this.file.data.slice(Number(offset), Number(offset + BigInt(size)));
    return { ret: 0, data: slice };
  }
  fd_seek(offset, whence) {
    let calculated_offset;
    switch (whence) {
      case WHENCE_SET:
        calculated_offset = offset;
        break;
      case WHENCE_CUR:
        calculated_offset = this.file_pos + offset;
        break;
      case WHENCE_END:
        calculated_offset = BigInt(this.file.data.byteLength) + offset;
        break;
      default:
        return { ret: ERRNO_INVAL, offset: 0n };
    }
    if (calculated_offset < 0) {
      return { ret: ERRNO_INVAL, offset: 0n };
    }
    this.file_pos = calculated_offset;
    return { ret: 0, offset: this.file_pos };
  }
  fd_tell() {
    return { ret: 0, offset: this.file_pos };
  }
  fd_write(data) {
    if (this.file.readonly) return { ret: ERRNO_BADF, nwritten: 0 };
    if (this.file_pos + BigInt(data.byteLength) > this.file.size) {
      const old = this.file.data;
      this.file.data = new Uint8Array(Number(this.file_pos + BigInt(data.byteLength)));
      this.file.data.set(old);
    }
    this.file.data.set(data, Number(this.file_pos));
    this.file_pos += BigInt(data.byteLength);
    return { ret: 0, nwritten: data.byteLength };
  }
  fd_pwrite(data, offset) {
    if (this.file.readonly) return { ret: ERRNO_BADF, nwritten: 0 };
    if (offset + BigInt(data.byteLength) > this.file.size) {
      const old = this.file.data;
      this.file.data = new Uint8Array(Number(offset + BigInt(data.byteLength)));
      this.file.data.set(old);
    }
    this.file.data.set(data, Number(offset));
    return { ret: 0, nwritten: data.byteLength };
  }
  fd_filestat_get() {
    return { ret: 0, filestat: this.file.stat() };
  }
  constructor(file) {
    super();
    this.file_pos = 0n;
    this.file = file;
  }
};
var OpenDirectory = class extends Fd {
  fd_seek(offset, whence) {
    return { ret: ERRNO_BADF, offset: 0n };
  }
  fd_tell() {
    return { ret: ERRNO_BADF, offset: 0n };
  }
  fd_allocate(offset, len) {
    return ERRNO_BADF;
  }
  fd_fdstat_get() {
    return { ret: 0, fdstat: new Fdstat(FILETYPE_DIRECTORY, 0) };
  }
  fd_readdir_single(cookie) {
    if (debug.enabled) {
      debug.log("readdir_single", cookie);
      debug.log(cookie, this.dir.contents.keys());
    }
    if (cookie == 0n) {
      return { ret: ERRNO_SUCCESS, dirent: new Dirent(1n, this.dir.ino, ".", FILETYPE_DIRECTORY) };
    } else if (cookie == 1n) {
      return { ret: ERRNO_SUCCESS, dirent: new Dirent(2n, this.dir.parent_ino(), "..", FILETYPE_DIRECTORY) };
    }
    if (cookie >= BigInt(this.dir.contents.size) + 2n) {
      return { ret: 0, dirent: null };
    }
    const [name, entry] = Array.from(this.dir.contents.entries())[Number(cookie - 2n)];
    return { ret: 0, dirent: new Dirent(cookie + 1n, entry.ino, name, entry.stat().filetype) };
  }
  path_filestat_get(flags, path_str) {
    const { ret: path_err, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_err, filestat: null };
    }
    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, filestat: null };
    }
    return { ret: 0, filestat: entry.stat() };
  }
  path_lookup(path_str, dirflags) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }
    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, inode_obj: null };
    }
    return { ret: ERRNO_SUCCESS, inode_obj: entry };
  }
  path_open(dirflags, path_str, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, fd_obj: null };
    }
    let { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      if (ret != ERRNO_NOENT) {
        return { ret, fd_obj: null };
      }
      if ((oflags & OFLAGS_CREAT) == OFLAGS_CREAT) {
        const { ret: ret2, entry: new_entry } = this.dir.create_entry_for_path(path_str, (oflags & OFLAGS_DIRECTORY) == OFLAGS_DIRECTORY);
        if (new_entry == null) {
          return { ret: ret2, fd_obj: null };
        }
        entry = new_entry;
      } else {
        return { ret: ERRNO_NOENT, fd_obj: null };
      }
    } else if ((oflags & OFLAGS_EXCL) == OFLAGS_EXCL) {
      return { ret: ERRNO_EXIST, fd_obj: null };
    }
    if ((oflags & OFLAGS_DIRECTORY) == OFLAGS_DIRECTORY && entry.stat().filetype !== FILETYPE_DIRECTORY) {
      return { ret: ERRNO_NOTDIR, fd_obj: null };
    }
    return entry.path_open(oflags, fs_rights_base, fd_flags);
  }
  path_create_directory(path) {
    return this.path_open(0, path, OFLAGS_CREAT | OFLAGS_DIRECTORY, 0n, 0n, 0).ret;
  }
  path_link(path_str, inode, allow_dir) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    if (path.is_dir) {
      return ERRNO_NOENT;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return parent_ret;
    }
    if (entry != null) {
      const source_is_dir = inode.stat().filetype == FILETYPE_DIRECTORY;
      const target_is_dir = entry.stat().filetype == FILETYPE_DIRECTORY;
      if (source_is_dir && target_is_dir) {
        if (allow_dir && entry instanceof Directory) {
          if (entry.contents.size == 0) {
          } else {
            return ERRNO_NOTEMPTY;
          }
        } else {
          return ERRNO_EXIST;
        }
      } else if (source_is_dir && !target_is_dir) {
        return ERRNO_NOTDIR;
      } else if (!source_is_dir && target_is_dir) {
        return ERRNO_ISDIR;
      } else if (inode.stat().filetype == FILETYPE_REGULAR_FILE && entry.stat().filetype == FILETYPE_REGULAR_FILE) {
      } else {
        return ERRNO_EXIST;
      }
    }
    if (!allow_dir && inode.stat().filetype == FILETYPE_DIRECTORY) {
      return ERRNO_PERM;
    }
    parent_entry.contents.set(filename, inode);
    return ERRNO_SUCCESS;
  }
  path_unlink(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, inode_obj: null };
    }
    if (entry == null) {
      return { ret: ERRNO_NOENT, inode_obj: null };
    }
    parent_entry.contents.delete(filename);
    return { ret: ERRNO_SUCCESS, inode_obj: entry };
  }
  path_unlink_file(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
    }
    if (entry.stat().filetype === FILETYPE_DIRECTORY) {
      return ERRNO_ISDIR;
    }
    parent_entry.contents.delete(filename);
    return ERRNO_SUCCESS;
  }
  path_remove_directory(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
    }
    if (!(entry instanceof Directory) || entry.stat().filetype !== FILETYPE_DIRECTORY) {
      return ERRNO_NOTDIR;
    }
    if (entry.contents.size !== 0) {
      return ERRNO_NOTEMPTY;
    }
    if (!parent_entry.contents.delete(filename)) {
      return ERRNO_NOENT;
    }
    return ERRNO_SUCCESS;
  }
  fd_filestat_get() {
    return { ret: 0, filestat: this.dir.stat() };
  }
  fd_filestat_set_size(size) {
    return ERRNO_BADF;
  }
  fd_read(size) {
    return { ret: ERRNO_BADF, data: new Uint8Array() };
  }
  fd_pread(size, offset) {
    return { ret: ERRNO_BADF, data: new Uint8Array() };
  }
  fd_write(data) {
    return { ret: ERRNO_BADF, nwritten: 0 };
  }
  fd_pwrite(data, offset) {
    return { ret: ERRNO_BADF, nwritten: 0 };
  }
  constructor(dir) {
    super();
    this.dir = dir;
  }
};
var PreopenDirectory = class extends OpenDirectory {
  fd_prestat_get() {
    return { ret: 0, prestat: Prestat.dir(this.prestat_name) };
  }
  constructor(name, contents) {
    super(new Directory(contents));
    this.prestat_name = name;
  }
};
var File = class extends Inode {
  path_open(oflags, fs_rights_base, fd_flags) {
    if (this.readonly && (fs_rights_base & BigInt(RIGHTS_FD_WRITE)) == BigInt(RIGHTS_FD_WRITE)) {
      return { ret: ERRNO_PERM, fd_obj: null };
    }
    if ((oflags & OFLAGS_TRUNC) == OFLAGS_TRUNC) {
      if (this.readonly) return { ret: ERRNO_PERM, fd_obj: null };
      this.data = new Uint8Array([]);
    }
    const file = new OpenFile(this);
    if (fd_flags & FDFLAGS_APPEND) file.fd_seek(0n, WHENCE_END);
    return { ret: ERRNO_SUCCESS, fd_obj: file };
  }
  get size() {
    return BigInt(this.data.byteLength);
  }
  stat() {
    return new Filestat(this.ino, FILETYPE_REGULAR_FILE, this.size);
  }
  constructor(data, options) {
    super();
    this.data = new Uint8Array(data);
    this.readonly = !!options?.readonly;
  }
};
var Path = class Path2 {
  static from(path) {
    const self = new Path2();
    self.is_dir = path.endsWith("/");
    if (path.startsWith("/")) {
      return { ret: ERRNO_NOTCAPABLE, path: null };
    }
    if (path.includes("\0")) {
      return { ret: ERRNO_INVAL, path: null };
    }
    for (const component of path.split("/")) {
      if (component === "" || component === ".") {
        continue;
      }
      if (component === "..") {
        if (self.parts.pop() == void 0) {
          return { ret: ERRNO_NOTCAPABLE, path: null };
        }
        continue;
      }
      self.parts.push(component);
    }
    return { ret: ERRNO_SUCCESS, path: self };
  }
  to_path_string() {
    let s = this.parts.join("/");
    if (this.is_dir) {
      s += "/";
    }
    return s;
  }
  constructor() {
    this.parts = [];
    this.is_dir = false;
  }
};
var Directory = class _Directory extends Inode {
  parent_ino() {
    if (this.parent == null) {
      return Inode.root_ino();
    }
    return this.parent.ino;
  }
  path_open(oflags, fs_rights_base, fd_flags) {
    return { ret: ERRNO_SUCCESS, fd_obj: new OpenDirectory(this) };
  }
  stat() {
    return new Filestat(this.ino, FILETYPE_DIRECTORY, 0n);
  }
  get_entry_for_path(path) {
    let entry = this;
    for (const component of path.parts) {
      if (!(entry instanceof _Directory)) {
        return { ret: ERRNO_NOTDIR, entry: null };
      }
      const child = entry.contents.get(component);
      if (child !== void 0) {
        entry = child;
      } else {
        debug.log(component);
        return { ret: ERRNO_NOENT, entry: null };
      }
    }
    if (path.is_dir) {
      if (entry.stat().filetype != FILETYPE_DIRECTORY) {
        return { ret: ERRNO_NOTDIR, entry: null };
      }
    }
    return { ret: ERRNO_SUCCESS, entry };
  }
  get_parent_dir_and_entry_for_path(path, allow_undefined) {
    const filename = path.parts.pop();
    if (filename === void 0) {
      return { ret: ERRNO_INVAL, parent_entry: null, filename: null, entry: null };
    }
    const { ret: entry_ret, entry: parent_entry } = this.get_entry_for_path(path);
    if (parent_entry == null) {
      return { ret: entry_ret, parent_entry: null, filename: null, entry: null };
    }
    if (!(parent_entry instanceof _Directory)) {
      return { ret: ERRNO_NOTDIR, parent_entry: null, filename: null, entry: null };
    }
    const entry = parent_entry.contents.get(filename);
    if (entry === void 0) {
      if (!allow_undefined) {
        return { ret: ERRNO_NOENT, parent_entry: null, filename: null, entry: null };
      } else {
        return { ret: ERRNO_SUCCESS, parent_entry, filename, entry: null };
      }
    }
    if (path.is_dir) {
      if (entry.stat().filetype != FILETYPE_DIRECTORY) {
        return { ret: ERRNO_NOTDIR, parent_entry: null, filename: null, entry: null };
      }
    }
    return { ret: ERRNO_SUCCESS, parent_entry, filename, entry };
  }
  create_entry_for_path(path_str, is_dir) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, entry: null };
    }
    let { ret: parent_ret, parent_entry, filename, entry } = this.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, entry: null };
    }
    if (entry != null) {
      return { ret: ERRNO_EXIST, entry: null };
    }
    debug.log("create", path);
    let new_child;
    if (!is_dir) {
      new_child = new File(new ArrayBuffer(0));
    } else {
      new_child = new _Directory(/* @__PURE__ */ new Map());
    }
    parent_entry.contents.set(filename, new_child);
    entry = new_child;
    return { ret: ERRNO_SUCCESS, entry };
  }
  constructor(contents) {
    super();
    this.parent = null;
    if (contents instanceof Array) {
      this.contents = new Map(contents);
    } else {
      this.contents = contents;
    }
    for (const entry of this.contents.values()) {
      if (entry instanceof _Directory) {
        entry.parent = this;
      }
    }
  }
};
var ConsoleStdout = class _ConsoleStdout extends Fd {
  fd_filestat_get() {
    const filestat = new Filestat(this.ino, FILETYPE_CHARACTER_DEVICE, BigInt(0));
    return { ret: 0, filestat };
  }
  fd_fdstat_get() {
    const fdstat = new Fdstat(FILETYPE_CHARACTER_DEVICE, 0);
    fdstat.fs_rights_base = BigInt(RIGHTS_FD_WRITE);
    return { ret: 0, fdstat };
  }
  fd_write(data) {
    this.write(data);
    return { ret: 0, nwritten: data.byteLength };
  }
  static lineBuffered(write) {
    const dec = new TextDecoder("utf-8", { fatal: false });
    let line_buf = "";
    return new _ConsoleStdout((buffer) => {
      line_buf += dec.decode(buffer, { stream: true });
      const lines = line_buf.split("\n");
      for (const [i, line] of lines.entries()) {
        if (i < lines.length - 1) {
          write(line);
        } else {
          line_buf = line;
        }
      }
    });
  }
  constructor(write) {
    super();
    this.ino = Inode.issue_ino();
    this.write = write;
  }
};

// web/host/src/bridge.js
var utf8 = new TextDecoder();
function refreshRaylibMemory(memory2, raylib2) {
  if (raylib2.HEAPU8.buffer !== memory2.buffer) raylib2.refreshMemoryViews();
}
function readScalar(view, pointer, size, type) {
  const signed = type === 0;
  if (type === 2 && size === 4) return view.getFloat32(pointer, true);
  if (type === 2 && size === 8) return view.getFloat64(pointer, true);
  if (type !== 0 && type !== 1) throw new Error(`Invalid ABI scalar ${type}/${size}`);
  if (size === 1) return signed ? view.getInt8(pointer) : view.getUint8(pointer);
  if (size === 2) return signed ? view.getInt16(pointer, true) : view.getUint16(pointer, true);
  if (size === 4) return signed ? view.getInt32(pointer, true) : view.getUint32(pointer, true);
  if (size === 8) return signed ? view.getBigInt64(pointer, true) : view.getBigUint64(pointer, true);
  throw new Error(`Invalid ABI scalar ${type}/${size}`);
}
function writeScalar(view, pointer, size, type, value) {
  if (type === 2 && size === 4) return view.setFloat32(pointer, value, true);
  if (type === 2 && size === 8) return view.setFloat64(pointer, value, true);
  if (type !== 0 && type !== 1) throw new Error(`Invalid ABI scalar ${type}/${size}`);
  if (size === 1) return view.setUint8(pointer, value);
  if (size === 2) return view.setUint16(pointer, value, true);
  if (size === 4) return view.setUint32(pointer, value, true);
  if (size === 8) return view.setBigUint64(pointer, BigInt.asUintN(64, value), true);
  throw new Error(`Invalid ABI scalar ${type}/${size}`);
}
function raylibImports(memory2, raylib2, {
  countCall = () => {
  },
  freeHaskell,
  raylibLimit = 128 * 1024 * 1024,
  invoke = (_name, fn, args) => fn(...args)
} = {}) {
  const refresh = () => {
    refreshRaylibMemory(memory2, raylib2);
    return new DataView(memory2.buffer);
  };
  const text = (pointer, length) => utf8.decode(new Uint8Array(memory2.buffer, pointer, length));
  return {
    memory: memory2,
    log: (pointer, length) => console.log(text(pointer, length)),
    free: (pointer) => {
      refresh();
      if (pointer < raylibLimit) raylib2._MemFree_(pointer);
      else if (freeHaskell) freeHaskell(pointer);
      else throw new Error("Missing Haskell libc free export for a high-memory allocation");
    },
    callRaylibFunction(namePointer, nameLength, paramsPointer, sizesPointer, typesPointer, count, returnSize, returnType) {
      const view = refresh();
      const name = text(namePointer, nameLength);
      const fn = raylib2[name];
      if (typeof fn !== "function") throw new Error(`Missing raylib export: ${name}`);
      const args = Array.from({ length: count }, (_, index) => readScalar(
        view,
        view.getUint32(paramsPointer + index * 4, true),
        view.getUint32(sizesPointer + index * 4, true),
        view.getUint8(typesPointer + index)
      ));
      countCall(name);
      const result = invoke(name, fn, args);
      if (returnSize === 0) return 0;
      const pointer = raylib2._MemAlloc_(returnSize);
      if (pointer === 0) throw new Error("Raylib arena exhausted allocating an FFI result");
      writeScalar(refresh(), pointer, returnSize, returnType, result);
      return pointer;
    }
  };
}
function immediatePoll(memory2) {
  return (input2, output, count, numberOfEvents) => {
    const view = new DataView(memory2.buffer);
    view.setUint32(numberOfEvents, 0, true);
    if (count === 0) return 28;
    let emitted = 0;
    for (let index = 0; index < count; index++) {
      const sub = input2 + index * 48;
      const type = view.getUint8(sub + 8);
      let flags = 0;
      if (type === 1 || type === 2) {
        const fd = view.getUint32(sub + 16, true);
        if (!(type === 1 && fd === 0 || type === 2 && (fd === 1 || fd === 2))) {
          return 58;
        }
        if (fd === 0) flags = 1;
      } else if (type === 0) {
        const clock = view.getUint32(sub + 16, true);
        const timeout = view.getBigUint64(sub + 24, true);
        const absolute = (view.getUint16(sub + 40, true) & 1) !== 0;
        if (clock !== 0 && clock !== 1) return 28;
        const now = clock === 0 ? BigInt(Date.now()) * 1000000n : BigInt(Math.round(performance.now() * 1e6));
        if (absolute ? timeout > now : timeout !== 0n) continue;
      } else return 28;
      const event = output + emitted * 32;
      new Uint8Array(memory2.buffer, event, 32).fill(0);
      view.setBigUint64(event, view.getBigUint64(sub, true), true);
      view.setUint8(event + 10, type);
      view.setUint16(event + 24, flags, true);
      emitted++;
    }
    if (emitted === 0) return 58;
    view.setUint32(numberOfEvents, emitted, true);
    return 0;
  };
}

// web/host/src/files.js
var decoder = new TextDecoder();
var SAVE_FOLDER = ".runtime/garden";
var SAVE_NAME = /^save-v2\.txt(?:\.previous|\.rejected(?:\.\d+)?)?$/;
var STORE_KEY = "afterlight:saves:v1";
function parts(path) {
  if (typeof path !== "string" || path.startsWith("/") || /[\\\0:]/.test(path)) return null;
  const result = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (result.pop() === void 0) return null;
    } else result.push(part);
  }
  return result;
}
function directory(root, path, create = false) {
  const segments = parts(path);
  if (!segments) return null;
  let current = root;
  for (const name of segments) {
    let next = current.contents.get(name);
    if (!next && create) {
      next = new Directory(/* @__PURE__ */ new Map());
      current.contents.set(name, next);
    }
    if (!(next instanceof Directory)) return null;
    current = next;
  }
  return current;
}
function putFile(root, path, bytes, readonly = false) {
  const segments = parts(path);
  if (!segments?.length) throw new Error(`Invalid file path: ${path}`);
  const name = segments.pop();
  const parent = directory(root, segments.join("/"), true);
  if (!parent) throw new Error(`Not a directory: ${path}`);
  parent.contents.set(name, new File(bytes, { readonly }));
}
function locationOf(root, path) {
  const segments = parts(path);
  if (!segments?.length) return null;
  const name = segments.pop();
  const parent = directory(root, segments.join("/"));
  return parent ? { parent, name, inode: parent.contents.get(name) } : null;
}
function findDirectory(root, wanted, prefix = "") {
  if (root === wanted) return prefix;
  for (const [name, child] of root.contents) {
    if (child instanceof Directory) {
      const found = findDirectory(child, wanted, prefix ? `${prefix}/${name}` : name);
      if (found !== null) return found;
    }
  }
  return null;
}
async function loadAssets(raylibFS, root, fetchFile = fetch, expect = () => {
}) {
  async function fetchAll() {
    const response = await fetchFile("./assets-manifest.json");
    if (response.status === 404) return { files: [], missingManifest: true };
    if (!response.ok) throw new Error(`Asset manifest: HTTP ${response.status}`);
    const manifest = await response.json();
    if (!Array.isArray(manifest)) throw new Error("Asset manifest must be an array");
    const seen = /* @__PURE__ */ new Set();
    for (const entry of manifest) {
      const path = entry?.path;
      if (typeof path !== "string" || !path.startsWith("assets/") || path.split("/").some((part) => !part || part === "." || part === "..") || /[\\\0:?#]/.test(path) || seen.has(path)) {
        throw new Error(`Invalid or duplicate asset path: ${path}`);
      }
      seen.add(path);
      expect(path, entry.bytes);
    }
    const files2 = new Array(manifest.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, manifest.length) }, async () => {
      while (cursor < manifest.length) {
        const index = cursor++;
        const { path } = manifest[index];
        const asset = await fetchFile(path);
        if (!asset.ok) throw new Error(`Asset ${path}: HTTP ${asset.status}`);
        files2[index] = { path, data: new Uint8Array(await asset.arrayBuffer()) };
      }
    }));
    return { files: files2, missingManifest: false };
  }
  const [fs, { files, missingManifest }] = await Promise.all([raylibFS, fetchAll()]);
  if (files.length && !fs) throw new Error("Export FS from Emscripten for asset loading");
  let bytes = 0;
  for (const { path, data } of files) {
    fs.mkdirTree(`/${path.slice(0, path.lastIndexOf("/"))}`);
    fs.writeFile(`/${path}`, data);
    putFile(root, path, data, true);
    bytes += data.byteLength;
  }
  return { count: files.length, bytes, missingManifest };
}
function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}
function fromBase64(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function persistent(path) {
  return path?.startsWith(`${SAVE_FOLDER}/`) && SAVE_NAME.test(path.slice(SAVE_FOLDER.length + 1));
}
function attachPersistence(wasiHost, memory2, root, {
  storage = () => localStorage,
  report = () => {
  }
} = {}) {
  const diagnostics = { restoredFiles: 0, writes: 0, lastError: null };
  const opened = /* @__PURE__ */ new Map();
  const dirty = /* @__PURE__ */ new Set();
  let durable = {};
  let invalidStore = false;
  directory(root, SAVE_FOLDER, true);
  const failure = (error) => {
    const code = error?.name === "QuotaExceededError" ? wasi_defs_exports.ERRNO_NOSPC : error?.name === "SecurityError" ? wasi_defs_exports.ERRNO_ACCES : wasi_defs_exports.ERRNO_IO;
    diagnostics.lastError = { name: error?.name, message: String(error?.message ?? error), errno: code };
    report(`Save persistence failed: ${diagnostics.lastError.message}`);
    return code;
  };
  try {
    const stored = storage().getItem(STORE_KEY);
    if (stored !== null) {
      let parsed;
      try {
        parsed = JSON.parse(stored);
        if (parsed.version !== 1 || !parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) {
          throw new Error("Unrecognized browser save container");
        }
        const restored = Object.entries(parsed.files).map(([path, data]) => {
          if (!persistent(path) || typeof data !== "string") throw new Error("Invalid browser save entry");
          return [path, fromBase64(data)];
        });
        for (const [path, data] of restored) putFile(root, path, data);
        durable = parsed.files;
        diagnostics.restoredFiles = restored.length;
      } catch (error) {
        invalidStore = true;
        throw error;
      }
    }
  } catch (error) {
    failure(error);
  }
  const snapshot = () => {
    const files = {};
    for (const [name, inode] of directory(root, SAVE_FOLDER).contents) {
      if (SAVE_NAME.test(name) && inode instanceof File) files[`${SAVE_FOLDER}/${name}`] = toBase64(inode.data);
    }
    return files;
  };
  const commit = () => {
    try {
      if (invalidStore) throw new Error("Existing browser save container needs recovery before overwriting");
      const files = snapshot();
      storage().setItem(STORE_KEY, JSON.stringify({ version: 1, files }));
      durable = files;
      diagnostics.writes++;
      diagnostics.lastError = null;
      return wasi_defs_exports.ERRNO_SUCCESS;
    } catch (error) {
      return failure(error);
    }
  };
  const restoreFile = (path) => {
    if (durable[path] !== void 0) putFile(root, path, fromBase64(durable[path]));
    else {
      const at = locationOf(root, path);
      at?.parent.contents.delete(at.name);
    }
  };
  const resolve = (fd, pointer, length) => {
    const relative = parts(decoder.decode(new Uint8Array(memory2.buffer, pointer, length)));
    const prefix = findDirectory(root, wasiHost.fds[fd]?.dir);
    return relative && prefix !== null ? [prefix, ...relative].filter(Boolean).join("/") : null;
  };
  const original = { ...wasiHost.wasiImport };
  wasiHost.wasiImport.path_open = (...args) => {
    const result = original.path_open(...args);
    if (result === 0) {
      const fd = new DataView(memory2.buffer).getUint32(args[8], true);
      const path = resolve(args[0], args[2], args[3]);
      opened.set(fd, path);
      if (persistent(path) && args[4] & (wasi_defs_exports.OFLAGS_CREAT | wasi_defs_exports.OFLAGS_TRUNC)) dirty.add(fd);
    }
    return result;
  };
  for (const method of ["fd_write", "fd_pwrite", "fd_filestat_set_size", "fd_allocate"]) {
    wasiHost.wasiImport[method] = (...args) => {
      const result = original[method](...args);
      if (result === 0 && persistent(opened.get(args[0]))) dirty.add(args[0]);
      return result;
    };
  }
  const sync = (fd) => {
    if (!dirty.has(fd)) return 0;
    const result = commit();
    if (result !== 0) restoreFile(opened.get(fd));
    dirty.delete(fd);
    return result;
  };
  for (const method of ["fd_sync", "fd_datasync", "fd_close"]) {
    wasiHost.wasiImport[method] = (fd) => {
      const result = original[method](fd);
      const saved = result === 0 ? sync(fd) : result;
      if (method === "fd_close") {
        opened.delete(fd);
        dirty.delete(fd);
      }
      return saved;
    };
  }
  wasiHost.wasiImport.path_rename = (...args) => {
    const source = resolve(args[0], args[1], args[2]);
    const target = resolve(args[3], args[4], args[5]);
    const before = [locationOf(root, source), locationOf(root, target)].filter(Boolean);
    const result = original.path_rename(...args);
    if (result !== 0 || !(persistent(source) || persistent(target))) return result;
    const saved = commit();
    if (saved !== 0) {
      for (const at of before) {
        if (at.inode) at.parent.contents.set(at.name, at.inode);
        else at.parent.contents.delete(at.name);
      }
    }
    return saved;
  };
  wasiHost.wasiImport.path_unlink_file = (...args) => {
    const path = resolve(args[0], args[1], args[2]);
    const at = locationOf(root, path);
    const result = original.path_unlink_file(...args);
    if (result !== 0 || !persistent(path)) return result;
    const saved = commit();
    if (saved !== 0 && at?.inode) at.parent.contents.set(at.name, at.inode);
    return saved;
  };
  return diagnostics;
}
function gameEnvironment(query, size = { width: 1280, height: 720 }) {
  const result = /* @__PURE__ */ new Map([["GARDEN_WIDTH", String(size.width)], ["GARDEN_HEIGHT", String(size.height)], ["GARDEN_PAUSED", "1"]]);
  for (const [key, env, min, max] of [
    ["width", "GARDEN_WIDTH", 960, 4096],
    ["height", "GARDEN_HEIGHT", 600, 2160],
    ["frames", "GARDEN_FRAMES", 1, 6e4]
  ]) {
    const value = query.get(key);
    if (value !== null && /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max) result.set(env, value);
  }
  for (const [key, env, values] of [
    ["tour", "GARDEN_TOUR", ["story", "islands"]],
    ["scene", "GARDEN_SCENE", ["day", "night", "dusk", "sky", "high", "kin", "return"]],
    ["paused", "GARDEN_PAUSED", ["0", "1"]],
    ["hud", "GARDEN_HUD", ["0", "1"]]
  ]) {
    const value = query.get(key);
    if (values.includes(value)) result.set(env, value);
  }
  return Array.from(result, ([key, value]) => `${key}=${value}`);
}

// web/host/src/input.js
var errorText = (error) => String(error?.stack || error?.message || error);
var gameKeys = /* @__PURE__ */ new Set([
  "F2",
  "F3",
  "F5",
  "F6",
  "F11",
  "F12",
  "Tab",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight"
]);
function canvasInput({
  canvas: canvas2,
  document: document2,
  keyboardTarget,
  fullscreenTarget = canvas2,
  recenter = () => {
  },
  enabled = () => true,
  menuEnabled = () => false,
  resumeAudio = () => {
  },
  activity = () => {
  },
  warn = () => {
  },
  changed = () => {
  },
  activation = () => typeof navigator === "undefined" ? null : navigator.userActivation,
  now = () => performance.now()
}) {
  let wanted = false, inGesture = false, gestureAt = 0, pending = null, latest = null, consumeMouseDown = false;
  let attempts = 0, failures = 0, lastFailure = null, lastRequest = null, active = false;
  const locked = () => document2.pointerLockElement === canvas2;
  const focused = () => document2.activeElement === canvas2;
  const acceptKey = (event) => focused() && enabled() && (active || menuEnabled() && !pending && (event.code || event.key) !== "Tab");
  const setActive = (value) => {
    if (active !== value) {
      active = value;
      activity(value);
    }
  };
  const notify = () => {
    setActive(wanted && locked());
    changed();
  };
  const reject = (attempt, error) => {
    if (!attempt) return;
    if (attempt.failed && error?.name === "Error") return;
    if (pending === attempt) pending = null;
    lastFailure = { name: error?.name ?? "Error", message: error?.message ?? String(error) };
    if (!attempt.failed) {
      attempt.failed = true;
      failures++;
    }
    warn(`Mouse capture failed (${lastFailure.name}): ${lastFailure.message}`);
    notify();
  };
  const request = () => {
    if (!inGesture || !wanted || locked() || pending || !enabled()) return;
    const attempt = { number: ++attempts, failed: false };
    latest = pending = attempt;
    const userActivation = activation();
    lastRequest = {
      timeMs: now(),
      gestureDelayMs: now() - gestureAt,
      activation: userActivation?.isActive ?? null,
      hasBeenActive: userActivation?.hasBeenActive ?? null,
      focused: document2.hasFocus?.() ?? null,
      visibility: document2.visibilityState ?? null,
      connected: canvas2.isConnected ?? null
    };
    try {
      if (typeof canvas2.requestPointerLock !== "function") throw new Error("Mouse capture is unavailable");
      const result = canvas2.requestPointerLock();
      result?.then(() => {
        if (pending === attempt) pending = null;
        if (!wanted && locked()) document2.exitPointerLock();
        notify();
      }, (error) => reject(attempt, error));
    } catch (error) {
      reject(attempt, error);
    }
    notify();
  };
  const gesture = (event, action = () => {
  }) => {
    const previous = inGesture;
    inGesture = event.isTrusted === true;
    gestureAt = now();
    const before = attempts;
    try {
      const value = action();
      if (attempts === before) request();
      return value;
    } finally {
      inGesture = previous;
    }
  };
  const engage = (event) => {
    if (!enabled() || !event.isTrusted || locked()) return;
    canvas2.focus({ preventScroll: true });
    gesture(event, () => {
      wanted = true;
      request();
      try {
        resumeAudio()?.catch((error) => warn(`Audio could not resume: ${errorText(error)}`, "audio"));
      } catch (error) {
        warn(`Audio could not resume: ${errorText(error)}`, "audio");
      }
    });
  };
  const pause = () => {
    wanted = false;
    if (locked()) document2.exitPointerLock();
    notify();
  };
  const fullscreen = () => {
    try {
      const result = document2.fullscreenElement === fullscreenTarget ? document2.exitFullscreen() : fullscreenTarget.requestFullscreen();
      result?.catch((error) => warn(`Fullscreen was declined: ${errorText(error)}`, "fullscreen"));
    } catch (error) {
      warn(`Fullscreen was declined: ${errorText(error)}`, "fullscreen");
    }
  };
  canvas2.addEventListener("pointerdown", (event) => {
    canvas2.focus({ preventScroll: true });
    consumeMouseDown = !active;
    if (!active) {
      event.stopImmediatePropagation?.();
      event.preventDefault();
      engage(event);
    }
  }, { capture: true });
  canvas2.addEventListener("mousedown", (event) => {
    if (consumeMouseDown || !active || pending) {
      event.stopImmediatePropagation?.();
      event.preventDefault();
    }
    consumeMouseDown = false;
  }, { capture: true });
  document2.addEventListener("pointerlockchange", () => {
    pending = null;
    if (locked()) {
      lastFailure = null;
      if (!wanted) document2.exitPointerLock();
      else recenter();
    } else {
      wanted = false;
    }
    notify();
  });
  document2.addEventListener("pointerlockerror", () => reject(pending ?? latest, new Error("The browser rejected the pointer-lock request")));
  keyboardTarget.addEventListener("blur", pause);
  document2.addEventListener("visibilitychange", () => {
    if (document2.visibilityState === "hidden") pause();
  });
  for (const type of ["keydown", "keyup"]) {
    keyboardTarget.addEventListener(type, (event) => {
      if (!acceptKey(event)) return;
      const code = event.code || event.key;
      if (code === "Escape") {
        event.stopImmediatePropagation?.();
        if (type === "keydown") pause();
        return;
      }
      if (gameKeys.has(code)) event.preventDefault();
      if (type === "keydown" && code === "F11" && !event.repeat && event.isTrusted) fullscreen();
    }, { capture: true });
  }
  return {
    gesture,
    engage,
    pause,
    fullscreen,
    acceptKey,
    snapshot: () => ({
      wanted,
      locked: locked(),
      active,
      pending: pending !== null,
      attempts,
      failures,
      lastFailure,
      lastRequest
    }),
    invoke(name, fn, args) {
      if (name === "_DisableCursor_") {
        wanted = true;
        request();
        notify();
        return;
      }
      if (name === "_EnableCursor_") {
        wanted = false;
        notify();
      }
      if (name === "_ToggleBorderlessWindowed_") return;
      return fn(...args);
    }
  };
}

// web/host/src/photos.js
var decoder2 = new TextDecoder();
var pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
function screenshotBridge({ memory: memory2, raylibFS, root, captured, warn = () => {
} }) {
  return (name, fn, args) => {
    if (name !== "_TakeScreenshot_") return fn(...args);
    const pointer = args[0];
    if (!Number.isInteger(pointer) || pointer < 0 || pointer >= memory2.buffer.byteLength) {
      throw new Error("Invalid screenshot filename pointer");
    }
    const bytes = new Uint8Array(memory2.buffer, pointer, Math.min(4096, memory2.buffer.byteLength - pointer));
    const end = bytes.indexOf(0);
    if (end < 0) throw new Error("Unterminated screenshot filename");
    const path = decoder2.decode(bytes.subarray(0, end));
    if (!path || path.startsWith("/") || /[\\:]/.test(path) || path.split("/").includes("..")) {
      throw new Error(`Screenshot path must be relative to the game: ${path}`);
    }
    const slash = path.lastIndexOf("/");
    if (slash > 0) raylibFS.mkdirTree(path.slice(0, slash));
    const result = fn(...args);
    if (!raylibFS.analyzePath(path).exists) {
      warn(`Photo export failed: ${path}`);
      return result;
    }
    const data = raylibFS.readFile(path);
    if (data.byteLength <= 8 || !pngSignature.every((value, index) => data[index] === value)) {
      warn(`Photo export did not produce a PNG: ${path}`);
      return result;
    }
    putFile(root, path, data);
    captured(path, data);
    return result;
  };
}
function photoDownload(link, urls = URL) {
  let currentURL;
  return (path, bytes) => {
    const nextURL = urls.createObjectURL(new Blob([bytes], { type: "image/png" }));
    const previousURL = currentURL;
    currentURL = nextURL;
    link.href = nextURL;
    link.download = path.slice(path.lastIndexOf("/") + 1);
    link.hidden = false;
    if (previousURL) urls.revokeObjectURL(previousURL);
  };
}

// web/host/src/loading.js
function downloads(changed = () => {
}, fetchFile = fetch) {
  const entries = /* @__PURE__ */ new Map();
  const snapshot = () => {
    const files = [...entries.values()];
    return {
      files: files.length,
      completed: files.filter((f) => f.done).length,
      loaded: files.reduce((n, f) => n + f.loaded, 0),
      total: files.every((f) => f.total > 0) ? files.reduce((n, f) => n + f.total, 0) : null
    };
  };
  const expect = (path, total) => {
    const entry = entries.get(path) ?? { loaded: 0, done: false, total: 0 };
    if (Number.isSafeInteger(total) && total > 0) entry.total = total;
    entries.set(path, entry);
    changed(snapshot());
  };
  async function trackedFetch(path, options) {
    expect(path, 0);
    const entry = entries.get(path);
    const response = await fetchFile(path, options);
    if (!response.ok) return response;
    if (!entry.total && !response.headers.get("content-encoding")) {
      entry.total = Number(response.headers.get("content-length")) || 0;
    }
    if (!response.body) {
      entry.done = true;
      changed(snapshot());
      return response;
    }
    const wasm = response.headers.get("content-type")?.trim().toLowerCase() === "application/wasm";
    const reader = (wasm ? response.clone() : response).body.getReader();
    const record2 = ({ done, value }) => {
      if (done) {
        entry.done = true;
        entry.total = entry.loaded;
      } else entry.loaded += value.byteLength;
      changed(snapshot());
      return { done, value };
    };
    if (wasm) {
      (async () => {
        while (!record2(await reader.read()).done) {
        }
      })().catch(() => {
      });
      return response;
    }
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = record2(await reader.read());
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel: (reason) => reader.cancel(reason)
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  return { fetch: trackedFetch, expect, snapshot };
}
async function compileModule(response) {
  const result = await response;
  if (!result.ok) throw new Error(`Game module: HTTP ${result.status}`);
  if (typeof WebAssembly.compileStreaming === "function" && result.headers.get("content-type")?.trim().toLowerCase() === "application/wasm") {
    return WebAssembly.compileStreaming(result);
  }
  return WebAssembly.compile(await result.arrayBuffer());
}

// web/host/src/viewport.js
function renderScale(value) {
  const scale = Number(value);
  return [1, 0.75, 0.5].includes(scale) ? scale : 1;
}
function drawingSize(width, height, { pixelRatio = 1, maxDimension = Infinity } = {}) {
  if (!(width > 0 && height > 0)) return { width: 1280, height: 720 };
  const density = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const factor = Math.min(density, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor))
  };
}

// web/host/src/render-check.js
function createRenderCheck(enabled) {
  if (!enabled) return null;
  let calls, previous, cpu, intervals, result;
  const reset = () => {
    calls = 0;
    previous = null;
    cpu = [];
    intervals = [];
    result = null;
  };
  const summary = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
  };
  reset();
  return {
    reset,
    sample(draw, at) {
      if (result) return;
      const began = performance.now();
      draw();
      const elapsed = performance.now() - began;
      if (calls >= 10) {
        cpu.push(elapsed);
        intervals.push(at - previous);
      }
      previous = at;
      calls++;
      if (calls === 100) result = { frames: cpu.length, cpuMs: summary(cpu), intervalMs: summary(intervals) };
    },
    snapshot: () => ({ calls, result })
  };
}

// web/host/src/host.js
var MIB = 1024 * 1024;
var RAYLIB_LIMIT = 128 * MIB;
var memory = new WebAssembly.Memory({ initial: 160 * MIB / 65536, maximum: 1024 * MIB / 65536 });
var canvas = document.querySelector("canvas");
var game = document.querySelector("#game");
var status = document.querySelector("#status");
var progress = document.querySelector("#progress");
var detail = document.querySelector("#detail");
var enter = document.querySelector("#enter");
var fullscreenButton = document.querySelector("#fullscreen");
var quality = document.querySelector("#quality");
var qualityKey = "afterlight:render-scale:v1";
try {
  quality.value = String(renderScale(localStorage.getItem(qualityKey)));
} catch {
}
var renderCheck = createRenderCheck(new URLSearchParams(location.search).get("render-check") === "1");
var captureMessage = document.querySelector("#capture-message");
var downloadPhoto = photoDownload(document.querySelector("#photo-download"));
var stats = { frames: 0, ffiCalls: 0, totalFrameMs: 0, maxFrameMs: 0, lastFrameMs: 0, errors: [] };
var logs = [];
var importantLogs = [];
var importantByMessage = /* @__PURE__ */ new Map();
var focusEvents = [];
var instance;
var raylib;
var state;
var frameId;
var bootId;
var input;
var running = false;
var requestedActivity;
var firstPlay = true;
var stopped = false;
var resizePending = false;
var qualityPending = false;
var bootCanceled = false;
var maxRenderDimension = Infinity;
var displayPixelRatio = window.devicePixelRatio;
var desiredSize = () => drawingSize(
  game.clientWidth,
  game.clientHeight,
  { pixelRatio: window.devicePixelRatio, maxDimension: maxRenderDimension }
);
var boot = {
  began: performance.now(),
  phase: "download",
  network: null,
  stages: {},
  modulesReadyMs: null,
  beginMs: null,
  readyMs: null,
  firstInputMs: null,
  maxStepMs: 0
};
var inspection = {
  stats,
  logs,
  importantLogs,
  focusEvents,
  memory,
  layout: void 0,
  ready: false,
  boot,
  get running() {
    return running;
  },
  get raylibBreak() {
    return raylib?._web_raylib_program_break?.();
  }
};
window.afterlightWeb = inspection;
var diagnosticsNode = new URLSearchParams(location.search).get("diagnostics") === "1" ? document.createElement("script") : null;
function focusState() {
  let windowFocused = null;
  let windowFocusError = null;
  try {
    windowFocused = raylib?._IsWindowFocused_?.() ?? null;
  } catch (error) {
    windowFocusError = String(error);
  }
  return {
    documentHasFocus: document.hasFocus(),
    visibilityState: document.visibilityState,
    activeElementId: document.activeElement?.id ?? null,
    activeElementTag: document.activeElement?.tagName ?? null,
    raylibWindowFocused: windowFocused,
    windowFocusError,
    pointerLockElementId: document.pointerLockElement?.id ?? null,
    canvasHasPointerLock: document.pointerLockElement === canvas,
    fullscreenElementId: document.fullscreenElement?.id ?? null,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    canvasClientWidth: canvas.clientWidth,
    canvasClientHeight: canvas.clientHeight
  };
}
function publishDiagnostics() {
  if (!diagnosticsNode) return;
  diagnosticsNode.textContent = JSON.stringify({
    ready: inspection.ready,
    running,
    memoryBytes: memory.buffer.byteLength,
    boot,
    audio: raylib?.audioState?.(),
    rendering: {
      pixelRatio: window.devicePixelRatio,
      scale: Number(quality.value),
      width: canvas.width,
      height: canvas.height,
      maxDimension: maxRenderDimension
    },
    renderCheck: renderCheck?.snapshot(),
    paints: performance.getEntriesByType("paint").map(({ name, startTime }) => ({ name, startTime })),
    raylibBreak: inspection.raylibBreak,
    layout: inspection.layout,
    environment: inspection.environment,
    assets: inspection.assets,
    persistence: inspection.persistence,
    photo: inspection.photo,
    focus: focusState(),
    focusEvents,
    input: input?.snapshot(),
    stats: {
      ...stats,
      averageFrameMs: stats.frames ? stats.totalFrameMs / stats.frames : 0,
      errors: stats.errors.slice(-5).map((message) => String(message).slice(0, 6e3))
    },
    logs: logs.slice(-20).map((entry) => ({ ...entry, message: String(entry.message).slice(0, 3e3) })),
    importantLogs: importantLogs.map((entry) => ({ ...entry, message: entry.message.slice(0, 3e3) }))
  });
}
if (diagnosticsNode) {
  diagnosticsNode.type = "application/json";
  diagnosticsNode.id = "web-diagnostics";
  document.body.append(diagnosticsNode);
  setInterval(publishDiagnostics, 1e3);
  publishDiagnostics();
}
function record(source, message, warning = false) {
  message = String(message);
  const timeMs = performance.now();
  logs.push({ source, message, timeMs });
  if (logs.length > 200) logs.shift();
  if (warning || /shader|warning|error|audio|failed|Loaded checkpoint|checkpoint saved|Could not save|Photo saved/i.test(message)) {
    const key = `${source}
${message}`;
    const prior = importantByMessage.get(key);
    if (prior) {
      prior.count++;
      prior.lastTimeMs = timeMs;
    } else {
      const entry = { source, message, firstTimeMs: timeMs, lastTimeMs: timeMs, count: 1 };
      importantByMessage.set(key, entry);
      importantLogs.push(entry);
      if (importantLogs.length > 128) {
        const [removed] = importantLogs.splice(96, 1);
        importantByMessage.delete(`${removed.source}
${removed.message}`);
      }
    }
  }
  (warning ? console.warn : console.log)(`[${source}] ${message}`);
}
function fail(error) {
  running = false;
  bootCanceled = true;
  if (frameId !== void 0) cancelAnimationFrame(frameId);
  if (bootId !== void 0) clearTimeout(bootId);
  input?.pause();
  const message = errorText(error);
  stats.errors.push(message);
  game.dataset.mode = "failed";
  status.textContent = "\u5EAD\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F";
  detail.textContent = "\u3082\u3046\u4E00\u5EA6\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\u3002\u4FDD\u5B58\u3057\u305F\u5EAD\u306F\u6B8B\u308A\u307E\u3059\u3002\u7E70\u308A\u8FD4\u3059\u5834\u5408\u306F\u4E0B\u306E\u8A73\u7D30\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002";
  progress.hidden = true;
  document.querySelector("#retry").hidden = false;
  document.querySelector("#error-details").hidden = false;
  document.querySelector("#error-text").textContent = `${boot.phase}
${message}`;
  console.error(error);
  publishDiagnostics();
}
function checkPartition() {
  const exports = instance.exports;
  const address = (name) => {
    const value = exports[name];
    if (!(value instanceof WebAssembly.Global)) throw new Error(`Missing layout export ${name}`);
    return value.value;
  };
  const layout = {
    raylibLimit: raylib._web_raylib_limit(),
    raylibHeapBase: raylib._web_raylib_heap_base(),
    raylibBreak: raylib._web_raylib_program_break(),
    raylibStackEnd: raylib._web_raylib_stack_end(),
    raylibStackBase: raylib._web_raylib_stack_base(),
    haskellGlobalBase: address("__global_base"),
    haskellDataEnd: address("__data_end"),
    haskellStackPointer: address("__stack_pointer"),
    haskellHeapBase: address("__heap_base"),
    memoryBytes: memory.buffer.byteLength
  };
  if (!(layout.raylibLimit === RAYLIB_LIMIT && layout.raylibStackEnd >= 0 && layout.raylibStackEnd < layout.raylibStackBase && layout.raylibStackBase <= layout.raylibHeapBase && layout.raylibHeapBase <= layout.raylibBreak && layout.raylibBreak < RAYLIB_LIMIT && layout.haskellGlobalBase >= RAYLIB_LIMIT && layout.haskellDataEnd > layout.haskellGlobalBase && layout.haskellStackPointer >= layout.haskellDataEnd && layout.haskellHeapBase >= layout.haskellStackPointer && layout.haskellHeapBase < layout.memoryBytes)) {
    throw new Error(`Overlapping or invalid WASM memory layout: ${JSON.stringify(layout)}`);
  }
  return layout;
}
function frame(at) {
  if (!running) return;
  try {
    if (instance.exports.shouldClose(state)) {
      instance.exports.teardown(state);
      state = void 0;
      running = false;
      stopped = true;
      input.pause();
      game.dataset.mode = "stopped";
      status.textContent = "\u5EAD\u3092\u8A18\u9332\u3057\u307E\u3057\u305F";
      detail.textContent = "\u307E\u305F\u3001\u3053\u3053\u304B\u3089\u3002";
      progress.hidden = true;
      document.querySelector("#retry").hidden = false;
      return;
    }
    if (resizePending || qualityPending || displayPixelRatio !== window.devicePixelRatio) {
      let redraw = qualityPending;
      if (qualityPending) {
        instance.exports.setQuality(state, Math.round(100 * renderScale(quality.value)));
        refreshRaylibMemory(memory, raylib);
        qualityPending = false;
      }
      resizePending = false;
      displayPixelRatio = window.devicePixelRatio;
      const size = desiredSize();
      if (canvas.width !== size.width || canvas.height !== size.height) {
        raylib._SetWindowSize_(size.width, size.height);
        redraw = true;
      }
      if (redraw) {
        renderCheck?.reset();
        if (firstPlay) {
          instance.exports.preview(state);
          refreshRaylibMemory(memory, raylib);
        }
      }
    }
    if (firstPlay) {
      renderCheck?.sample(() => {
        instance.exports.preview(state);
        refreshRaylibMemory(memory, raylib);
      }, at);
      frameId = requestAnimationFrame(frame);
      return;
    }
    if (requestedActivity !== void 0) {
      const active = requestedActivity;
      requestedActivity = void 0;
      raylib.clearInput();
      instance.exports.setActive(state, Number(active));
      if (active && boot.firstInputMs === null) boot.firstInputMs = performance.now() - boot.began;
    }
    const began = performance.now();
    state = instance.exports.mainLoop(state);
    refreshRaylibMemory(memory, raylib);
    stats.lastFrameMs = performance.now() - began;
    stats.frames++;
    stats.totalFrameMs += stats.lastFrameMs;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, stats.lastFrameMs);
    if (raylib._web_raylib_program_break() > RAYLIB_LIMIT) throw new Error("Raylib crossed the memory boundary");
    frameId = requestAnimationFrame(frame);
  } catch (error) {
    fail(error);
  }
}
var phaseNames = ["", "\u5EAD\u306E\u304B\u305F\u3061\u3092\u7D50\u3093\u3067\u3044\u307E\u3059", "\u5149\u3068\u97F3\u3092\u6574\u3048\u3066\u3044\u307E\u3059", "\u5EAD\u306B\u666F\u8272\u3092\u5E83\u3052\u3066\u3044\u307E\u3059", "\u6700\u521D\u306E\u666F\u8272\u3092\u6620\u3057\u3066\u3044\u307E\u3059"];
function phase(name, message, completed = 0, total = 0) {
  boot.phase = name;
  status.textContent = message;
  if (total > 0) {
    progress.max = total;
    progress.value = completed;
  } else progress.removeAttribute("value");
}
function prepare() {
  if (bootCanceled) return;
  try {
    const stage = instance.exports.loadingStage(state);
    const done = instance.exports.loadingDone(state), total = instance.exports.loadingTotal(state);
    phase(`prepare-${stage}`, phaseNames[stage], done, total);
    detail.textContent = stage === 3 ? `${done.toLocaleString()} / ${total.toLocaleString()}` : "\u305D\u306E\u307E\u307E\u3001\u5C11\u3057\u304A\u5F85\u3061\u304F\u3060\u3055\u3044";
    const began = performance.now();
    if (stage === 4) instance.exports.setQuality(state, Math.round(100 * renderScale(quality.value)));
    state = instance.exports.mainLoop(state);
    refreshRaylibMemory(memory, raylib);
    const elapsed = performance.now() - began;
    boot.maxStepMs = Math.max(boot.maxStepMs, elapsed);
    boot.stages[stage] = (boot.stages[stage] ?? 0) + elapsed;
    if (instance.exports.isReady(state)) {
      boot.readyMs = performance.now() - boot.began;
      boot.phase = "ready";
      inspection.ready = true;
      running = true;
      game.dataset.mode = "ready";
      canvas.focus({ preventScroll: true });
      publishDiagnostics();
      frameId = requestAnimationFrame(frame);
    } else {
      publishDiagnostics();
      schedulePreparation();
    }
  } catch (error) {
    fail(error);
  }
}
function schedulePreparation() {
  if (window.scheduler?.yield) window.scheduler.yield().then(prepare).catch(fail);
  else bootId = setTimeout(prepare, 0);
}
async function load() {
  phase("download", "\u97F3\u3068\u5149\u3092\u5C4A\u3051\u3066\u3044\u307E\u3059");
  const preopen = new PreopenDirectory(".", /* @__PURE__ */ new Map());
  const size = desiredSize();
  const environment = gameEnvironment(new URLSearchParams(location.search), size);
  const wasi = new WASI(["afterlight"], environment, [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered((message) => record("Haskell", message)),
    ConsoleStdout.lineBuffered((message) => record("Haskell stderr", message, true)),
    preopen
  ], { debug: false });
  inspection.environment = environment;
  inspection.persistence = attachPersistence(wasi, memory, preopen.dir, {
    report: (message) => record("storage", message, true)
  });
  const transfer = downloads((value) => {
    boot.network = value;
    if (boot.phase !== "download") return;
    if (value.total) {
      progress.max = value.total;
      progress.value = value.loaded;
    } else progress.removeAttribute("value");
    detail.textContent = `${(value.loaded / 1e6).toFixed(1)} MB${value.total ? ` / ${(value.total / 1e6).toFixed(1)} MB` : ""}`;
  });
  const haskellModule = compileModule(transfer.fetch("./haskell.wasm"));
  const raylibModule = compileModule(transfer.fetch("./raylib.wasm"));
  const raylibReady = import("./raylib.mjs").then(({ default: Raylib }) => {
    let rejectInstantiation;
    const instantiationFailure = new Promise((_, reject) => {
      rejectInstantiation = reject;
    });
    return Promise.race([instantiationFailure, Raylib({
      canvas,
      wasmMemory: memory,
      noInitialRun: true,
      locateFile: (path) => new URL(path, location.href).href,
      print: (message) => record("raylib", message),
      printErr: (message) => record("raylib stderr", message, true),
      onAbort: (reason) => rejectInstantiation(new Error(`raylib abort: ${reason}`)),
      instantiateWasm(imports, receive) {
        raylibModule.then(async (module) => receive(await WebAssembly.instantiate(module, imports), module)).catch(rejectInstantiation);
        return {};
      }
    })]);
  });
  const assetsReady = loadAssets(raylibReady.then((module) => module.FS), preopen.dir, transfer.fetch, transfer.expect);
  const [loadedRaylib, assets, compiledHaskell] = await Promise.all([raylibReady, assetsReady, haskellModule]);
  raylib = loadedRaylib;
  raylib.acceptKey = input.acceptKey;
  inspection.assets = assets;
  if (typeof raylib.refreshMemoryViews !== "function") throw new Error("Missing host memory hooks");
  phase("initialize", "\u5EAD\u3092\u3072\u3089\u3044\u3066\u3044\u307E\u3059");
  detail.textContent = "\u3082\u3046\u3059\u3050\u3001\u6700\u521D\u306E\u666F\u8272\u3078";
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const screenshots = screenshotBridge({
    memory,
    raylibFS: raylib.FS,
    root: preopen.dir,
    captured: (path, bytes) => {
      downloadPhoto(path, bytes);
      inspection.photo = { path, bytes: bytes.byteLength };
      publishDiagnostics();
    },
    warn: (message) => record("photo", message, true)
  });
  instance = await WebAssembly.instantiate(compiledHaskell, {
    wasi_snapshot_preview1: { ...wasi.wasiImport, poll_oneoff: immediatePoll(memory) },
    env: raylibImports(memory, raylib, {
      countCall: () => {
        stats.ffiCalls++;
      },
      freeHaskell: (pointer) => instance.exports.free(pointer),
      raylibLimit: RAYLIB_LIMIT,
      invoke: (name, fn, args) => name === "_TakeScreenshot_" ? screenshots(name, fn, args) : input.invoke(name, fn, args)
    })
  });
  inspection.layout = checkPartition();
  if (typeof instance.exports.free !== "function") throw new Error("Export Haskell's libc free for allocator dispatch");
  wasi.initialize({ exports: { ...instance.exports, memory } });
  instance.exports.hs_init(0, 0);
  refreshRaylibMemory(memory, raylib);
  boot.modulesReadyMs = performance.now() - boot.began;
  const began = performance.now();
  state = instance.exports.startup();
  refreshRaylibMemory(memory, raylib);
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL 2 context is unavailable");
  maxRenderDimension = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const limitedSize = desiredSize();
  if (canvas.width !== limitedSize.width || canvas.height !== limitedSize.height) {
    raylib._SetWindowSize_(limitedSize.width, limitedSize.height);
  }
  boot.beginMs = performance.now() - began;
  boot.maxStepMs = Math.max(boot.maxStepMs, boot.beginMs);
  schedulePreparation();
}
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  fail(new Error("WebGL context lost. Reload to reacquire resources."));
});
input = canvasInput({
  canvas,
  document,
  keyboardTarget: window,
  fullscreenTarget: game,
  enabled: () => inspection.ready && !stopped && running,
  menuEnabled: () => !firstPlay,
  resumeAudio: () => raylib?.resumeAudio?.(),
  activity: (active) => {
    requestedActivity = active;
    if (active) firstPlay = false;
  },
  recenter: () => raylib._SetMousePosition_(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
  warn: (message, kind) => {
    record("browser input", message, true);
    if (kind === "fullscreen") captureMessage.textContent = "\u5168\u753B\u9762\u3078\u306E\u5207\u308A\u66FF\u3048\u304C\u8A31\u53EF\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3053\u306E\u753B\u9762\u306E\u307E\u307E\u904A\u3079\u307E\u3059\u3002";
    if (kind === "audio") captureMessage.textContent = "\u97F3\u3092\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u518D\u958B\u6642\u306B\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u307E\u3059\u3002";
  },
  changed: () => {
    const mode = input?.snapshot();
    if (inspection.ready && !stopped && running) {
      game.dataset.mode = mode?.active ? "playing" : firstPlay ? "ready" : "paused";
      enter.textContent = mode?.pending ? "\u64CD\u4F5C\u3092\u6E96\u5099\u3057\u3066\u3044\u307E\u3059\u2026" : firstPlay ? "\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u5EAD\u3078" : "\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u518D\u958B";
      captureMessage.textContent = mode?.lastFailure ? mode.lastFailure.name === "WrongDocumentError" ? "\u3053\u306E\u30BF\u30D6\u3092\u30D6\u30E9\u30A6\u30B6\u306E\u624B\u524D\u306B\u8868\u793A\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u30DE\u30A6\u30B9\u3092\u6355\u6349\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u304B\u3001\u30D6\u30E9\u30A6\u30B6\u306E\u30B5\u30A4\u30C8\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "WASD\u3067\u6B69\u304F \xB7 \u30DE\u30A6\u30B9\u3067\u898B\u56DE\u3059 \xB7 Esc\u3067\u30E1\u30CB\u30E5\u30FC";
    }
    publishDiagnostics();
  }
});
enter.addEventListener("click", (event) => input.engage(event));
quality.addEventListener("change", () => {
  qualityPending = true;
  try {
    localStorage.setItem(qualityKey, quality.value);
  } catch {
  }
});
fullscreenButton.addEventListener("click", () => input.fullscreen());
document.addEventListener("fullscreenchange", () => {
  const active = document.fullscreenElement === game;
  const label = active ? "\u5168\u753B\u9762\u3092\u7D42\u4E86" : "\u5168\u753B\u9762\u306B\u5207\u308A\u66FF\u3048";
  fullscreenButton.textContent = active ? "\u26F6 \u5168\u753B\u9762\u3092\u7D42\u4E86" : "\u26F6 \u5168\u753B\u9762";
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.title = `${label}\uFF08F11\uFF09`;
  resizePending = true;
});
document.querySelector("#retry").addEventListener("click", () => location.reload());
new ResizeObserver(() => {
  resizePending = true;
}).observe(game);
inspection.input = input;
for (const [target, type] of [
  [window, "focus"],
  [window, "blur"],
  [canvas, "focus"],
  [canvas, "blur"],
  [document, "visibilitychange"],
  [document, "pointerlockchange"],
  [document, "pointerlockerror"],
  [document, "fullscreenchange"]
]) {
  target.addEventListener(type, () => {
    focusEvents.push({
      event: type,
      target: target === canvas ? "canvas" : target === window ? "window" : "document",
      timeMs: performance.now(),
      ...focusState()
    });
    if (focusEvents.length > 16) focusEvents.shift();
    publishDiagnostics();
  });
}
window.addEventListener("unhandledrejection", (event) => fail(event.reason));
load().catch(fail);
