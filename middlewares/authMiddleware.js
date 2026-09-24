module.exports = {
    isAuth: (req, res, next) => {
        if (req.session && req.session.user) {
            return next();
        }
        res.redirect('/admin/login');
    },
    isGuest: (req, res, next) => {
        if (req.session && req.session.user) {
            return res.redirect('/admin/dashboard');
        }
        next();
    }
};