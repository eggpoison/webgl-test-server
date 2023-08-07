import { EntityType, Point, SETTINGS, TribeType, clampToBoardDimensions } from "webgl-test-shared";
import TribeMember from "./entities/tribes/TribeMember";
import TribeHut from "./entities/tribes/TribeHut";
import Tribesman from "./entities/tribes/Tribesman";
import TribeTotem from "./entities/tribes/TribeTotem";
import Board from "./Board";
import Tile from "./tiles/Tile";

const TRIBE_BUILDING_AREA_INFLUENCES = {
   tribe_totem: 200,
   tribe_hut: 150
} satisfies Partial<Record<EntityType, number>>;

interface TileInfluence {
   readonly tile: Tile;
   /** The number of buildings contributing to the tile */
   numInfluences: number;
}

class Tribe {
   public readonly tribeType: TribeType;

   public readonly totem: TribeTotem;
   
   private readonly members = new Array<TribeMember>();

   /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<TribeHut>();

   /** Stores all tiles in the tribe's zone of influence */
   private area: Record<number, TileInfluence> = {};

   public tribesmanCap = 0;
   
   constructor(tribeType: TribeType, totem: TribeTotem) {
      this.tribeType = tribeType;
      this.totem = totem;

      totem.createEvent("death", () => {
         this.destroy();
      });
   }

   public addTribeMember(member: TribeMember): void {
      this.members.push(member);
   }

   public registerNewHut(hut: TribeHut): void {
      this.huts.push(hut);

      // Create a tribesman for the hut
      this.createNewTribesman(hut);

      this.addBuildingToTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES.tribe_hut);
      
      this.tribesmanCap++;
   }

   public removeHut(hut: TribeHut): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }
      
      this.tribesmanCap--;
   }

   public hasHut(hut: TribeHut): boolean {
      return this.huts.includes(hut);
   }

   public hasTotem(totem: TribeTotem): boolean {
      return this.totem === totem;
   }

   private createNewTribesman(hut: TribeHut): void {
      const position = hut.position.copy();
      
      const tribesman = new Tribesman(position, false, this, this.tribeType);
      this.members.push(tribesman);

      // Attempt to respawn the tribesman when it is killed
      tribesman.createEvent("death", () => {
         // Only respawn the tribesman if their hut is alive
         if (Board.gameObjectIsInBoard(hut)) {
            this.respawnTribesman(hut);
         }
      });
   }

   private respawnTribesman(hut: TribeHut): void {
      this.createNewTribesman(hut);
   }

   public getNumHuts(): number {
      return this.huts.length;
   }

   /** Destroys the tribe and all its associated buildings */
   private destroy(): void {
      for (const tribeMember of this.members) {
         tribeMember.setTribe(null);
      }

      // Remove huts
      for (const hut of this.huts) {
         hut.remove();
      }
   }

   private addBuildingToTiles(buildingPosition: Point, influence: number): void {
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SETTINGS.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SETTINGS.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SETTINGS.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SETTINGS.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.addTileToArea(tileX, tileY);
         }
      }
   }

   private addTileToArea(tileX: number, tileY: number): void {
      const tile = Board.getTile(tileX, tileY);
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;

      if (!this.area.hasOwnProperty(tileIndex)) {
         // If the tile isn't in the area, create a new record
         this.area[tileIndex] = {
            tile: tile,
            numInfluences: 1
         }
      } else {
         this.area[tileIndex].numInfluences++;
      }
   }

   public tileIsInArea(tileX: number, tileY: number): boolean {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
      return this.area.hasOwnProperty(tileIndex);
   }
}

export default Tribe;