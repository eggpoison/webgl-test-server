import { EntityType } from "webgl-test-shared";
import Cow from "./entities/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import Tombstone from "./entities/Tombstone";
import Zombie from "./entities/Zombie";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (...args: any[]) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   tombstone: () => Tombstone,
   player: () => Player
};

export default ENTITY_CLASS_RECORD;