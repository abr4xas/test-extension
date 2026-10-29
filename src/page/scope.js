// The scope: the monsters the server reports in range and the hero's position, rebuilt from the
// game server's incoming packets. Read and removed by monsters.js; tests feed it recorded bytes.
globalThis.__openmuCreateScope = ({ isNpc = () => false, onSpawn = () => {} } = {}) => {
  const ID_MASK = 0x7fff; // The high bit flags a fresh spawn.
  const readId = (bytes, at) => ((bytes[at] << 8) | bytes[at + 1]) & ID_MASK;

  /** @type {Map<number, {type: number, x: number, y: number}>} */
  const monsters = new Map();
  let map = null;
  // The player's own object id (from GameServerEntered) and last known position. The position on
  // entering a map comes in an encrypted packet, so it is only known after the first step or teleport.
  let heroId = null;
  let hero = null;
  // Bumped on every change, so callers can skip work when nothing moved.
  let version = 0;

  function handlePacket(p) {
    const type = p[0];
    if (type === 0xc2 && p[3] === 0x13) {
      // AddNpcsToScope: count, then per object: id(2) type(2) x y targetX targetY rotation effectCount effects.
      let offset = 5;
      for (let i = 0; i < p[4] && offset + 10 <= p.length; i++) {
        const monster = { type: (p[offset + 2] << 8) | p[offset + 3], x: p[offset + 4], y: p[offset + 5] };
        // Every type is reported, but NPCs, guards and statues stay out of the scope.
        onSpawn({ ...monster, map });
        if (!isNpc(monster.type)) monsters.set(readId(p, offset), monster);
        offset += 10 + p[offset + 9];
      }
      version++;
      return;
    }
    if (type !== 0xc1) return;

    const code = p[2];
    if (code === 0xf1 && p[3] === 0x00 && p.length >= 7) {
      // GameServerEntered: result, then the player's id(2).
      heroId = readId(p, 5);
      hero = null;
    } else if ((code === 0xd4 || code === 0x15) && p.length >= 7) {
      // ObjectWalked (target position) / ObjectMoved (instant move): id(2) x y.
      const id = readId(p, 3);
      if (id === heroId) {
        hero = { x: p[5], y: p[6] };
        version++;
        return;
      }
      const monster = monsters.get(id);
      if (monster) {
        monster.x = p[5];
        monster.y = p[6];
        version++;
      }
    } else if (code === 0x14) {
      // MapObjectOutOfScope: count, then ids.
      for (let i = 0; i < p[3]; i++) monsters.delete(readId(p, 4 + i * 2));
      version++;
    } else if (code === 0x17 && p.length >= 5) {
      // ObjectGotKilled: killed id first.
      monsters.delete(readId(p, 3));
      version++;
    }
  }

  // MU packets: C1/C3 = [type, len, code, ...], C2/C4 = [type, lenHi, lenLo, code, ...].
  // A WebSocket frame may hold several packets or only part of one, so parse as a stream.
  function createParser() {
    let pending = new Uint8Array(0);
    return (bytes) => {
      const data = new Uint8Array(pending.length + bytes.length);
      data.set(pending);
      data.set(bytes, pending.length);
      let offset = 0;
      while (offset < data.length) {
        const type = data[offset];
        const isShort = type === 0xc1 || type === 0xc3;
        if (!isShort && type !== 0xc2 && type !== 0xc4) {
          pending = new Uint8Array(0); // Lost sync; drop and wait for the next frame.
          return;
        }
        if (data.length - offset < (isShort ? 2 : 3)) break;
        const length = isShort ? data[offset + 1] : (data[offset + 1] << 8) | data[offset + 2];
        if (length < 3) {
          pending = new Uint8Array(0);
          return;
        }
        if (data.length - offset < length) break;
        handlePacket(data.subarray(offset, offset + length));
        offset += length;
      }
      pending = data.slice(offset);
    };
  }

  return {
    // One stream per socket, each with its own partial packet.
    openStream() {
      return {
        feed: createParser(),
        close() {
          monsters.clear();
          version++;
        },
      };
    },
    // The server does not always remove every object on a map change, so a new map starts fresh.
    // Returns whether the map changed.
    setMap(index) {
      const changed = map !== null && index !== map;
      if (changed) {
        monsters.clear();
        hero = null;
        version++;
      }
      map = index;
      return changed;
    },
    snapshot() {
      return {
        version,
        map,
        hero: hero && { ...hero },
        monsters: [...monsters].map(([id, monster]) => ({ id, ...monster })),
      };
    },
  };
};
