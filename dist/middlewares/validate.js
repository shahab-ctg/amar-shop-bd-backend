export const validateQuery = (schema) => (req, res, next) => {
    const parsed = schema.parse(req.query);
    res.locals.query = parsed;
    next();
};
export const validateBody = (schema) => (req, res, next) => {
    const parsed = schema.parse(req.body);
    res.locals.body = parsed;
    next();
};
//# sourceMappingURL=validate.js.map