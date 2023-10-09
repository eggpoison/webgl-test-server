import { EntityType, Point, SETTINGS, TribeType, Vector, clampToBoardDimensions } from "webgl-test-shared";
import TribeMember from "./entities/tribes/TribeMember";
import TribeHut from "./entities/tribes/TribeHut";
import Tribesman from "./entities/tribes/Tribesman";
import TribeTotem from "./entities/tribes/TribeTotem";
import Board from "./Board";
import Tile from "./tiles/Tile";
import Barrel from "./entities/tribes/Barrel";
import Chunk from "./Chunk";

let idCounter = 0;

const getAvailableID = (): number => {
   return idCounter++;
}

const TRIBE_BUILDING_AREA_INFLUENCES = {
   tribe_totem: 200,
   tribe_hut: 150
} satisfies Partial<Record<EntityType, number>>;

interface TileInfluence {
   readonly tile: Tile;
   /** The number of buildings contributing to the tile */
   numInfluences: number;
}

interface ChunkInfluence {
   readonly chunk: Chunk;
   numInfluences: number;
}

class Tribe {
   public readonly id: number;
   
   public readonly tribeType: TribeType;

   public readonly totem: TribeTotem;
   
   private readonly members = new Array<TribeMember>();

   // /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<TribeHut>();

   private barrels = new Set<Barrel>();

   /** Stores all tiles in the tribe's zone of influence */
   private area: Record<number, TileInfluence> = {};
   private chunkArea: Record<number, ChunkInfluence> = {};

   public tribesmanCap = 0;
   
   constructor(tribeType: TribeType, totem: TribeTotem) {
      this.id = getAvailableID();
      
      this.tribeType = tribeType;
      this.totem = totem;
      totem.setTribe(this);

      totem.createEvent("death", () => {
         this.destroy();
      });

      this.addBuildingToTiles(totem.position, TRIBE_BUILDING_AREA_INFLUENCES.tribe_totem);
   }

   public tick(): void {
      this.updateBarrels();
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

      hut.createEvent("death", () => {
         this.removeHut(hut);
      });

      this.totem.createNewBanner(this.huts.length - 1);
   }

   public removeHut(hut: TribeHut): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }

      this.totem.removeBanner(idx);

      this.removeBuildingFromTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES.tribe_hut);
      
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

      // Offset the spawn position so the tribesman comes out of the correct side of the hut
      const offset = Point.fromVectorForm(10, hut.rotation);
      position.add(offset);
      
      const tribesman = new Tribesman(position, this.tribeType, this);
      tribesman.rotation = hut.rotation;

      this.members.push(tribesman);

      // Attempt to respawn the tribesman when it  is killed
      tribesman.createEvent("death", () => {
         // Only respawn the tribesman if their hut is alive
         if (Board.gameObjectIsInBoard(hut)) {
            this.createNewTribesman(hut);
         }
      });
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

      Board.removeTribe(this);
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

   private removeBuildingFromTiles(buildingPosition: Point, influence: number): void {
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SETTINGS.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SETTINGS.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SETTINGS.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SETTINGS.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.removeTileFromArea(tileX, tileY);
         }
      }
   }

   private removeTileFromArea(tileX: number, tileY: number): void {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
      if (!this.area.hasOwnProperty(tileIndex)) {
         return;
      } else {
         this.area[tileIndex].numInfluences--;
         if (this.area[tileIndex].numInfluences === 0) {
            delete this.area[tileIndex];
         }
      }

      const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);
      const chunkIndex = chunkY * SETTINGS.BOARD_SIZE + chunkX;
      if (!this.chunkArea.hasOwnProperty(chunkIndex)) {
         return;
      } else {
         this.chunkArea[chunkIndex].numInfluences--;
         if (this.chunkArea[chunkIndex].numInfluences === 0) {
            delete this.chunkArea[chunkIndex];
         }
      }
   }

   private addTileToArea(tileX: number, tileY: number): void {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
      if (!this.area.hasOwnProperty(tileIndex)) {
         // If the tile isn't in the area, create a new record
         const tile = Board.getTile(tileX, tileY);
         this.area[tileIndex] = {
            tile: tile,
            numInfluences: 1
         };
      } else {
         this.area[tileIndex].numInfluences++;
      }

      const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);
      const chunkIndex = chunkY * SETTINGS.BOARD_SIZE + chunkX;
      if (!this.chunkArea.hasOwnProperty(chunkIndex)) {
         const chunk = Board.getChunk(chunkX, chunkY);
         this.chunkArea[chunkIndex] = {
            chunk: chunk,
            numInfluences: 1
         };
      } else {
         this.chunkArea[chunkIndex].numInfluences++;
      }
   }

   public tileIsInArea(tileX: number, tileY: number): boolean {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
      return this.area.hasOwnProperty(tileIndex);
   }

   public numTiles(): number {
      return Object.keys(this.area).length;
   }

   /** Updates which barrels belong to the tribe */
   private updateBarrels(): void {
      for (const barrel of this.barrels) {
         barrel.setTribe(null);
      }
      
      const barrels = new Set<Barrel>();
      for (const chunkInfluence of Object.values(this.chunkArea)) {
         for (const entity of chunkInfluence.chunk.entities) {
            if (entity.type === "barrel") {
               (entity as Barrel).setTribe(this);
               barrels.add(entity as Barrel);
            }
         }
      }
      this.barrels = barrels;
   }

   public hasBarrel(barrel: Barrel): boolean {
      return this.barrels.has(barrel);
   }

   public getBarrels(): ReadonlySet<Barrel> {
      return this.barrels;
   }

   public getArea(): ReadonlyArray<Tile> {
      const area = new Array<Tile>();
      for (const tileInfluence of Object.values(this.area)) {
         area.push(tileInfluence.tile);
      }
      return area;
   }
}

export default Tribe;