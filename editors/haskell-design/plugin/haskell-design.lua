if vim.g.loaded_haskell_design then return end
vim.g.loaded_haskell_design = true
for name, method in pairs({ HaskellDesign = 'open', HaskellDesignSource = 'source', HaskellDesignVerify = 'verify', HaskellDesignDiff = 'diff', HaskellDesignFiles = 'files', HaskellDesignTests = 'tests', HaskellDesignEvidence = 'evidence', HaskellDesignRefresh = 'refresh' }) do
  vim.api.nvim_create_user_command(name, function() local hd = require('haskell-design'); hd.setup(); hd[method]() end, { desc = 'Haskell Design: ' .. method })
end
