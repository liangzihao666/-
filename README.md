# 昊量光电 2027 年会抽奖

蓝白配色的年会三维抽奖页。姓名牌排成斐波那契球面，开始后球体加速旋转，停止时中奖者的姓名牌飞到镜头前。默认奖项为特等奖、一等奖、二等奖、三等奖，已中奖的人不会再次进入抽奖池。名单、奖项和中奖记录保存在本机浏览器。

界面配色来自昊量光电 / Aunion：`#0869ac` 与 `#079bb8`，面板为白与冰蓝。舞台上方是按官网三维场景挤出的箭头标志和 aunion 字标。

## 运行

```bash
npm i && npm run dev
```

浏览器打开终端里给出的本地地址（默认 `http://localhost:5173`）。建议使用桌面版 Chrome 或 Edge。空格键可以开始和停止。

生产构建：

```bash
npm run build
npm run preview
```

## 修改人员和奖项

1. 打开页面右上角「名单与奖项」。
2. 人员每行一位，格式 `姓名,部门`，例如 `林启明,光学研发`。
3. 奖项可改名称、名额、每次抽取人数和礼品说明。
4. 保存后写入浏览器 `localStorage`，键名是 `aunion-gala-lottery-2027`。刷新页面会沿用这份数据。
5. 「清空中奖记录」只清结果，人员回到抽奖池。「恢复示例数据」回到仓库里的演示名单。

不想用界面时，可以直接改 `src/lottery.js` 里的 `defaultPeople`、`defaultPrizes` 和 `defaultTitle`，然后在设置里点「恢复示例数据」，或清掉上述 localStorage 键。

同一人只中一次。某个奖项的「每次」人数不会超过该奖剩余名额，也不会超过尚未中奖的人数。

## 致谢

球面姓名牌的排布，沿用 [log-lottery](https://github.com/LOG1997/log-lottery)（Vue 3 + Three.js，MIT）里的 `createSphereVertices`，也就是 Three.js CSS3D 球面示例的斐波那契公式。本仓库没有整包搬入 log-lottery，只保留这场年会要用的抽奖流程，并改成昊量光电的蓝白舞台。

挤出 Logo 来自昊量光电官网三维场景 `BrandScene.makeBrand()`：箭头轮廓、青色扫光，以及 `wordmark-paths.json` 里的 aunion 字标。页眉使用 `aunion-logo.png`。

## 许可

本仓库代码见 [LICENSE](LICENSE)（MIT）。log-lottery 的版权与许可说明见 [NOTICE](NOTICE)。
