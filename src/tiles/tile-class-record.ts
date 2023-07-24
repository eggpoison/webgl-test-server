import { TileInfo, TileType } from "webgl-test-shared";
import BaseTile from "./Tile";
import DirtTile from "./DirtTile";
import GrassTile from "./GrassTile";
import IceTile from "./IceTile";
import LavaTile from "./LavaTile";
import MagmaTile from "./MagmaTile";
import RockTile from "./RockTile";
import SandstoneTile from "./SandstoneTile";
import SandTile from "./SandTile";
import SludgeTile from "./SludgeTile";
import SnowTile from "./SnowTile";
import WaterTile from "./WaterTile";
import Tile from "./Tile";
import PermafrostTile from "./PermafrostTile";

const TILE_CLASS_RECORD: Record<TileType, new(x: number, y: number, info: TileInfo) => BaseTile> = {
   grass: GrassTile,
   dirt: DirtTile,
   water: WaterTile,
   sludge: SludgeTile,
   // TODO: make actual slime tile
   slime: RockTile,
   rock: RockTile,
   sand: SandTile,
   sandstone: SandstoneTile,
   snow: SnowTile,
   ice: IceTile,
   magma: MagmaTile,
   lava: LavaTile,
   permafrost: PermafrostTile
};

export function createGenericTile(x: number, y: number, tileInfo: TileInfo): Tile {
   const tileClass = TILE_CLASS_RECORD[tileInfo.type!];
   return new tileClass(x, y, tileInfo);
}

export default TILE_CLASS_RECORD;