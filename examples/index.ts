import express from "express";
import * as livereload from "livereload";
import { connectLivereload } from "../";
import * as path from "path";

const app = express();
const port = 3000;

const staticpath = path.resolve(__dirname, "static");

// Used before static middleware
app.all("*", connectLivereload());
app.use(express.static(staticpath));

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});

const liveReloadServer = livereload.createServer();
liveReloadServer.watch(staticpath);
