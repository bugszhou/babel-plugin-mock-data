const fs = require("fs");
const pathLib = require("path");

/** @typedef {import("@babel/types")} babel */
/** @typedef {import("@babel/types").MemberExpression} MemberExpression */
/** @typedef {import("@types/babel__traverse/index").NodePath} NodePath */

module.exports = function mockData(api, options, dirname) {
  /** @type {babel} */
  const types = api.types;
  return {
    visitor: {
      /**
       *
       * @param {NodePath} path
       * @returns
       */
      ExpressionStatement(path) {
        if (!types.isAssignmentExpression(path.node.expression)) {
          return;
        }
        /** @type {MemberExpression} */
        const left = path.node.expression.left;
        if (!types.isIdentifier(left.property)) {
          return;
        }
        const propertyName = left.property.name;

        if (
          propertyName === "data" &&
          left.object &&
          types.isObjectExpression(path.node.expression.right)
        ) {
          generateMock(api, path);
          return;
        }
      },
    },
  };
};

/**
 *
 * @param {*} api
 * @param {NodePath} path
 * @returns
 */
function generateMock(api, path) {
  try {
    /** @type {babel} */
    const types = api.types;
    /** @type {MemberExpression} */
    const left = path.node.expression.left;
    if (!types.isIdentifier(left.property)) {
      return;
    }
    const propertyName = left.property.name;

    if (!propertyName || !left.object) {
      return;
    }

    const comments = path.node.leadingComments || [];
    const mockComments = comments.filter((item) =>
      item.value.includes("mock-data:"),
    );
    let comment = mockComments[0];

    if (!comment) {
      return;
    }

    let data = comment.value.split(":");
    const index = Number(data[data.length - 1]) || 1;

    comment = mockComments[index - 1];

    if (!comment) {
      return;
    }

    data = comment.value.split(":");

    const pathUrl = data[1].trim();
    if (!fs.existsSync(pathLib.join(process.cwd(), pathUrl))) {
      return;
    }

    const customData = JSON.stringify(
      Function(
        `return ${fs
          .readFileSync(pathLib.join(process.cwd(), pathUrl))
          .toString()}`,
      )(),
    );

    const objName = left.object.name;
    const replaceExpression = api.template.ast(
      `${objName}.data=${customData};`,
    );
    path.replaceWith(replaceExpression);
    path.skip();
  } catch (e) {
    console.error(e);
  }
}
