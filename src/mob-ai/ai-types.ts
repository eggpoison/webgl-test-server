export enum MobAIs {
   wander = 0,
   follow = 1,
   herd = 2,
   tileConsume = 3,
   itemConsume = 4,
   escape = 5,
   chase = 6,
   berryBushShake = 7,
   move = 8,
   item_chase = 9
};

export type AIType = keyof typeof MobAIs;