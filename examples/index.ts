import * as express from "express";
import * as livereload from "livereload";
import { connectLivereload } from "connect-livereload";

const app = express();
const port = 3000;

const staticpath = "./static";
app.use(connectLivereload());

const liveReloadServer = livereload.createServer();
liveReloadServer.watch(staticpath);

app.use(express.static(staticpath));


app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
