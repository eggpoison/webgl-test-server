import { EntityType, Point } from "webgl-test-shared";
import Boulder from "./entities/resources/Boulder";
import Cow from "./entities/mobs/Cow";
import Entity from "./entities/Entity";
import Player from "./entities/tribes/Player";
import Tombstone from "./entities/Tombstone";
import Tree from "./entities/resources/Tree";
import Workbench from "./entities/Workbench";
import Zombie from "./entities/mobs/Zombie";
import BerryBush from "./entities/resources/BerryBush";
import Cactus from "./entities/resources/Cactus";
import Yeti from "./entities/mobs/Yeti";
import IceSpikes from "./entities/resources/IceSpikes";
import Slime from "./entities/mobs/Slime";
import Slimewisp from "./entities/mobs/Slimewisp";
import Tribesman from "./entities/tribes/Tribesman";
import TribeTotem from "./entities/tribes/TribeTotem";
import TribeHut from "./entities/tribes/TribeHut";

const ENTITY_CLASS_RECORD: Record<EntityType, () => (new (position: Point, isNaturallySpawned: boolean, ...args: any[]) => Entity)> = {
   cow: () => Cow,
   zombie: () => Zombie,
   tombstone: () => Tombstone,
   tree: () => Tree,
   workbench: () => Workbench,
   boulder: () => Boulder,
   berry_bush: () => BerryBush,
   cactus: () => Cactus,
   yeti: () => Yeti,
   ice_spikes: () => IceSpikes,
   slime: () => Slime,
   slimewisp: () => Slimewisp,
   tribesman: () => Tribesman,
   player: () => Player,
   tribe_totem: () => TribeTotem,
   tribe_hut: () => TribeHut
};

export default ENTITY_CLASS_RECORD;