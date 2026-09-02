
import {integer, serial, pgTable, timestamp,varchar} from "drizzle-orm/pg-core";

export const blog = pgTable("blog",{
    id:integer().primaryKey(),
    tittle:varchar(),
    desc:varchar(),
    counts:integer()
})



export const user = pgTable("user", {
    id: integer('id').primaryKey(),
    name: varchar(),
    email: varchar(),
    password: varchar(),
    createdat: timestamp().defaultNow().notNull()
});

export const  visted = pgTable("visted",{
    id:integer().primaryKey(),
    name:varchar(),
    
})

export const  comes = pgTable("comes",{
    id:integer().primaryKey(),
    name:varchar(),
    comesL:varchar()
})