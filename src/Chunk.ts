import { Point, RiverSteppingStoneData, RiverSteppingStoneSize } from "webgl-test-shared";
import { GameObject } from "./GameObject";
import Projectile from "./Projectile";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Mob from "./entities/mobs/Mob";

export interface RiverSteppingStone {
   readonly position: Point;
   readonly rotation: number;
   readonly size: RiverSteppingStoneSize;
}

class Chunk {
   /** Stores all game objects inside the chunk */
   public readonly gameObjects = new Array<GameObject>();
   
   public readonly entities = new Set<Entity>();
   public readonly droppedItems = new Set<DroppedItem>();
   public readonly projectiles = new Set<Projectile>();

   /** Stores all mobs which have the chunk in their vision range */
   public readonly viewingMobs = new Array<Mob>();

   public readonly riverSteppingStones = new Array<RiverSteppingStone>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addRiverSteppingStone(steppingStoneData: RiverSteppingStoneData): void {
      const steppingStone: RiverSteppingStone = {
         position: Point.unpackage(steppingStoneData.position),
         rotation: steppingStoneData.rotation,
         size: steppingStoneData.size
      };
      this.riverSteppingStones.push(steppingStone);
   }
}

export default Chunk;