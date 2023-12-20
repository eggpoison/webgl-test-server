import { IEntityType, Point, SETTINGS, TribeType, clampToBoardDimensions } from "webgl-test-shared";
import Board from "./Board";
import Tile from "./Tile";
import Chunk from "./Chunk";
import Entity from "./GameObject";
import { TotemBannerComponentArray, TribeComponentArray } from "./components/ComponentArray";
import { createTribesman } from "./entities/tribes/tribesman";
import { addBannerToTotem, removeBannerFromTotem } from "./components/TotemBannerComponent";

let idCounter = 0;

const getAvailableID = (): number => {
   return idCounter++;
}

const TRIBE_BUILDING_AREA_INFLUENCES = {
   [IEntityType.tribeTotem]: 200,
   [IEntityType.tribeHut]: 150
} satisfies Partial<Record<IEntityType, number>>;

interface TileInfluence {
   readonly tile: Tile;
   /** The number of buildings contributing to the tile */
   numInfluences: number;
}

interface ChunkInfluence {
   readonly chunk: Chunk;
   numInfluences: number;
}

interface ReinforcementInfo {
   readonly targetEntity: Entity;
   secondsSinceNotice: number;
}

class Tribe {
   private static readonly REINFORCEMENT_NOTICE_DURATION_SECONDS = 60;
   
   public readonly id: number;
   
   public readonly tribeType: TribeType;

   public readonly totem: Entity;
   
   private readonly members = new Array<Entity>();

   // /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<Entity>();

   private barrels = new Set<Entity>();

   /** Stores all tiles in the tribe's zone of influence */
   private area: Record<number, TileInfluence> = {};
   private chunkArea: Record<number, ChunkInfluence> = {};

   public tribesmanCap = 0;

   public readonly reinforcementInfoArray = new Array<ReinforcementInfo>();
   
   constructor(tribeType: TribeType, totem: Entity) {
      this.id = getAvailableID();
      
      this.tribeType = tribeType;
      this.totem = totem;
      TribeComponentArray.getComponent(totem).tribe = this;

      // @Incomplete
      // totem.createEvent("death", () => {
      //    this.destroy();
      // });

      this.addBuildingToTiles(totem.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.tribeTotem]);
   }

   public tick(): void {
      this.updateBarrels();

      for (let i = 0; i < this.reinforcementInfoArray.length; i++) {
         const info = this.reinforcementInfoArray[i];

         // Remove notices for removed entities
         if (info.targetEntity.isRemoved) {
            this.reinforcementInfoArray.splice(i, 1);
            i--;
            continue;
         }

         // Remove old notices
         info.secondsSinceNotice += 1 / SETTINGS.TPS;
         if (info.secondsSinceNotice >= Tribe.REINFORCEMENT_NOTICE_DURATION_SECONDS) {
            this.reinforcementInfoArray.splice(i, 1);
            i--;
         }
      }
   }

   public addTribeMember(member: Entity): void {
      this.members.push(member);
   }

   public registerNewHut(hut: Entity): void {
      this.huts.push(hut);

      // Create a tribesman for the hut
      this.createNewTribesman(hut);

      this.addBuildingToTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.tribeHut]);
      
      this.tribesmanCap++;

      // hut.createEvent("death", () => {
      //    this.removeHut(hut);
      // });
      
      const bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
      addBannerToTotem(bannerComponent, this.huts.length - 1);
   }

   public removeHut(hut: Entity): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }

      const bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
      removeBannerFromTotem(bannerComponent, idx);

      this.removeBuildingFromTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.tribeHut]);
      
      this.tribesmanCap--;
   }

   public hasHut(hut: Entity): boolean {
      return this.huts.includes(hut);
   }

   public hasTotem(totem: Entity): boolean {
      return this.totem === totem;
   }

   private createNewTribesman(hut: Entity): void {
      const position = hut.position.copy();

      // Offset the spawn position so the tribesman comes out of the correct side of the hut
      const offset = Point.fromVectorForm(10, hut.rotation);
      position.add(offset);
      
      const tribesman = createTribesman(position, this.tribeType, this);
      tribesman.rotation = hut.rotation;

      this.members.push(tribesman);

      // Attempt to respawn the tribesman when it is killed
      // @Incomplete
      // tribesman.createEvent("death", () => {
      //    // Only respawn the tribesman if their hut is alive
      //    if (!hut.isRemoved) {
      //       this.createNewTribesman(hut);
      //    }
      // });
   }

   public getNumHuts(): number {
      return this.huts.length;
   }

   /** Destroys the tribe and all its associated buildings */
   private destroy(): void {
      for (const tribeMember of this.members) {
         TribeComponentArray.getComponent(tribeMember).tribe = null;
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
         const tribeComponent = TribeComponentArray.getComponent(barrel);
         tribeComponent.tribe = null;
      }
      
      const barrels = new Set<Entity>();
      for (const chunkInfluence of Object.values(this.chunkArea)) {
         for (const entity of chunkInfluence.chunk.entities) {
            if (entity.type === IEntityType.barrel) {
               const tribeComponent = TribeComponentArray.getComponent(entity);
               tribeComponent.tribe = this;
               barrels.add(entity as Entity);
            }
         }
      }
      this.barrels = barrels;
   }

   public hasBarrel(barrel: Entity): boolean {
      return this.barrels.has(barrel);
   }

   public getBarrels(): ReadonlySet<Entity> {
      return this.barrels;
   }

   public getArea(): ReadonlyArray<Tile> {
      const area = new Array<Tile>();
      for (const tileInfluence of Object.values(this.area)) {
         area.push(tileInfluence.tile);
      }
      return area;
   }

   public requestReinforcements(target: Entity): void {
      let idx = -1;
      for (let i = 0; i < this.reinforcementInfoArray.length; i++) {
         const reinforcementInfo = this.reinforcementInfoArray[i];
         if (reinforcementInfo.targetEntity === target) {
            idx = i;
         }
      }

      if (idx === -1) {
         this.reinforcementInfoArray.push({
            targetEntity: target,
            secondsSinceNotice: 0
         });
      } else {
         this.reinforcementInfoArray[idx].secondsSinceNotice = 0;
      }
   }
}

export default Tribe;