import { RiverSteppingStoneData } from "webgl-test-shared";
import Projectile from "./Projectile";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Mob from "./entities/mobs/Mob";
import GameObject from "./GameObject";

class Chunk {
   /** Stores all game objects inside the chunk */
   public readonly gameObjects = new Array<GameObject>();
   
   public readonly entities = new Set<Entity>();
   public readonly droppedItems = new Set<DroppedItem>();
   public readonly projectiles = new Set<Projectile>();

   /** Stores all mobs which have the chunk in their vision range */
   public readonly viewingMobs = new Array<Mob>();

   public readonly riverSteppingStones = new Array<RiverSteppingStoneData>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }
}

export default Chunk;